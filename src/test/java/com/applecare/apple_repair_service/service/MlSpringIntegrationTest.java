package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.config.MlServiceProperties;
import com.applecare.apple_repair_service.dto.request.AssignTechnicianRequest;
import com.applecare.apple_repair_service.dto.response.AssignmentResponse;
import com.applecare.apple_repair_service.enums.AssignmentSource;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.enums.PredictionSource;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.integration.ml.MlPredictionClient;
import com.applecare.apple_repair_service.integration.ml.MlServiceUnavailableException;
import com.applecare.apple_repair_service.repository.RepairItemRepository;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class MlSpringIntegrationTest {
    static final OffsetDateTime AT = OffsetDateTime.of(2026, 10, 6, 14, 10, 0, 0, ZoneOffset.ofHours(7));
    final MlPredictionClient client = mock(MlPredictionClient.class);
    final RepairItemRepository items = mock(RepairItemRepository.class);
    final MlCandidateEstimateService estimates = new MlCandidateEstimateService(client, items);
    final com.applecare.apple_repair_service.entity.ServiceTicket ticket = TestData.ticket(ServiceTicketStatus.WAITING_ASSIGNMENT);

    @BeforeEach
    void setup() {
        when(items.findAllByServiceTicket_Id(1L)).thenReturn(List.of(TestData.item(1, ticket,
                com.applecare.apple_repair_service.enums.ApprovalStatus.APPROVED)));
    }

    MlPredictionClient.ModelMetadata model() {
        return new MlPredictionClient.ModelMetadata("CatBoostRegressor", "repair-duration-final-synthetic-v1",
                "EXPERIMENTAL_DEMO", "repair-duration-features-v1.1", true, false);
    }

    MlPredictionClient.BatchResponse response(MlPredictionClient.CandidatePrediction... rows) {
        return new MlPredictionClient.BatchResponse(1L, AT, List.of(rows), model());
    }

    @Test
    void mlSuccessMapsOneCandidateAndTruthfulMetadata() {
        when(client.predictCandidates(1L, List.of(2L), AT)).thenReturn(response(
                new MlPredictionClient.CandidatePrediction(2L, 55.4, List.of())));
        var result = estimates.estimate(ticket, List.of(2L), AT).get(2L);
        assertEquals(PredictionSource.ML, result.source());
        assertEquals(55.4, result.predictedTechnicalMinutes());
        assertEquals(55, result.durationMinutes());
        assertEquals("EXPERIMENTAL_DEMO", result.modelStatus());
        assertTrue(result.syntheticData());
        assertFalse(result.productionValidated());
    }

    @Test
    void mlSuccessMapsMultipleCandidatesWithoutRanking() {
        when(client.predictCandidates(1L, List.of(2L, 3L), AT)).thenReturn(response(
                new MlPredictionClient.CandidatePrediction(2L, 55.0, List.of()),
                new MlPredictionClient.CandidatePrediction(3L, 70.0, List.of())));
        var result = estimates.estimate(ticket, List.of(2L, 3L), AT);
        assertEquals(List.of(2L, 3L), result.keySet().stream().toList());
        assertEquals(55, result.get(2L).durationMinutes());
        assertEquals(70, result.get(3L).durationMinutes());
    }

    @Test
    void warningsIncludingUnseenCatalogArePreservedAndNonFatal() {
        when(client.predictCandidates(anyLong(), anyList(), any())).thenReturn(response(
                new MlPredictionClient.CandidatePrediction(2L, 45.5,
                        List.of("COLD_START_TECHNICIAN", "UNSEEN_CATALOG_CATEGORY"))));
        var result = estimates.estimate(ticket, List.of(2L), AT).get(2L);
        assertEquals(PredictionSource.ML, result.source());
        assertEquals(List.of("COLD_START_TECHNICIAN", "UNSEEN_CATALOG_CATEGORY"), result.warnings());
    }

    @ParameterizedTest
    @ValueSource(strings = {"ML_TIMEOUT", "CONNECTION_REFUSED", "ML_HTTP_503", "MALFORMED_JSON", "MODEL_NOT_READY"})
    void mlFailuresUseStandardDurationFallback(String reason) {
        when(client.predictCandidates(anyLong(), anyList(), any()))
                .thenThrow(new MlServiceUnavailableException(reason, "safe"));
        var result = estimates.estimate(ticket, List.of(2L), AT).get(2L);
        assertEquals(PredictionSource.STANDARD_DURATION_FALLBACK, result.source());
        assertEquals(30, result.durationMinutes());
        assertEquals(List.of(reason), result.warnings());
    }

    @Test
    void partialCandidateResponseFallsBackOnlyForMissingCandidate() {
        when(client.predictCandidates(anyLong(), anyList(), any())).thenReturn(response(
                new MlPredictionClient.CandidatePrediction(2L, 40.0, List.of())));
        var result = estimates.estimate(ticket, List.of(2L, 3L), AT);
        assertEquals(PredictionSource.ML, result.get(2L).source());
        assertEquals(PredictionSource.STANDARD_DURATION_FALLBACK, result.get(3L).source());
        assertEquals(30, result.get(3L).durationMinutes());
    }

    @Test
    void unsupportedMultiItemContextDoesNotCallMl() {
        when(items.findAllByServiceTicket_Id(1L)).thenReturn(List.of(
                TestData.item(1, ticket, com.applecare.apple_repair_service.enums.ApprovalStatus.APPROVED),
                TestData.item(2, ticket, com.applecare.apple_repair_service.enums.ApprovalStatus.APPROVED)));
        var result = estimates.estimate(ticket, List.of(2L), AT).get(2L);
        assertEquals(PredictionSource.STANDARD_DURATION_FALLBACK, result.source());
        assertEquals(60, result.durationMinutes());
        verifyNoInteractions(client);
    }

    @Test
    void invalidTicketStateDoesNotCallMl() {
        ticket.setStatus(ServiceTicketStatus.ASSIGNED);
        assertEquals(PredictionSource.STANDARD_DURATION_FALLBACK,
                estimates.estimate(ticket, List.of(2L), AT).get(2L).source());
        verifyNoInteractions(client);
    }

    @Test
    void assignmentWithMlRefinesOnlyAfterAuthoritativeAssignment() {
        var preparation = mock(AssignmentPredictionPreparationService.class);
        var assignmentService = mock(AssignmentService.class);
        var refinement = mock(MlAssignmentRefinementService.class);
        var estimate = new MlCandidateEstimateService.TechnicalEstimate(2L, 55, 55, PredictionSource.ML,
                List.of(), "CatBoostRegressor", "v1", "EXPERIMENTAL_DEMO", "v1.1", true, false, AT);
        when(preparation.prepare(1L, 2L, AT)).thenReturn(estimate);
        var request = new AssignTechnicianRequest(2L, 1L, AssignmentSource.MANUAL_OVERRIDE);
        var assigned = new AssignmentResponse(9L, 1L, 2L, "Tech", 1L, AssignmentSource.MANUAL_OVERRIDE,
                AssignmentStatus.ACTIVE, AT.toLocalDateTime(), null, null);
        when(assignmentService.assignTechnician(1L, request)).thenReturn(assigned);
        var orchestration = new AssignmentOrchestrationService(preparation, assignmentService, refinement, TestData.CLOCK);
        // TestData clock represents exactly 10:00 +07, not AT; match the generated shared instant.
        when(preparation.prepare(eq(1L), eq(2L), any())).thenReturn(estimate);
        assertSame(assigned, orchestration.assign(1L, request));
        var order = inOrder(assignmentService, refinement);
        order.verify(assignmentService).assignTechnician(1L, request);
        order.verify(refinement).refine(1L, 2L, 1L, estimate);
    }

    @Test
    void fallbackStillAssignsAndDoesNotPersistFakeMlAudit() {
        var preparation = mock(AssignmentPredictionPreparationService.class);
        var assignmentService = mock(AssignmentService.class);
        var refinement = mock(MlAssignmentRefinementService.class);
        var fallback = new MlCandidateEstimateService.TechnicalEstimate(2L, 30, 30,
                PredictionSource.STANDARD_DURATION_FALLBACK, List.of("ML_TIMEOUT"),
                null, null, null, null, false, false, null);
        when(preparation.prepare(eq(1L), eq(2L), any())).thenReturn(fallback);
        var request = new AssignTechnicianRequest(2L, 1L, AssignmentSource.MANUAL_OVERRIDE);
        var assigned = mock(AssignmentResponse.class);
        when(assignmentService.assignTechnician(1L, request)).thenReturn(assigned);
        var orchestration = new AssignmentOrchestrationService(preparation, assignmentService, refinement, TestData.CLOCK);
        assertSame(assigned, orchestration.assign(1L, request));
        verifyNoInteractions(refinement);
    }

    @Test
    void auditRefinementFailureNeverRollsBackSuccessfulAssignment() {
        var preparation = mock(AssignmentPredictionPreparationService.class);
        var assignmentService = mock(AssignmentService.class);
        var refinement = mock(MlAssignmentRefinementService.class);
        var estimate = new MlCandidateEstimateService.TechnicalEstimate(2L, 55, 55, PredictionSource.ML,
                List.of(), "CatBoostRegressor", "v1", "EXPERIMENTAL_DEMO", "v1.1", true, false, AT);
        when(preparation.prepare(eq(1L), eq(2L), any())).thenReturn(estimate);
        var request = new AssignTechnicianRequest(2L, 1L, AssignmentSource.MANUAL_OVERRIDE);
        var assigned = mock(AssignmentResponse.class);
        when(assignmentService.assignTechnician(1L, request)).thenReturn(assigned);
        doThrow(new IllegalStateException("audit down")).when(refinement).refine(anyLong(), anyLong(), anyLong(), any());
        assertSame(assigned, new AssignmentOrchestrationService(preparation, assignmentService, refinement, TestData.CLOCK)
                .assign(1L, request));
    }

    @Test
    void httpClientSendsExactFastApiContractAndMapsResponse() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var properties = new MlServiceProperties();
        var actual = new MlPredictionClient(builder.build(), properties);
        server.expect(requestTo("/api/v1/repair-duration/predict-candidates"))
                .andExpect(content().json("""
                    {"ticketId":1,"candidateTechnicianIds":[2,3],"evaluationTimestamp":"2026-10-06T14:10:00+07:00"}
                    """))
                .andRespond(withSuccess("""
                    {"ticketId":1,"evaluationTimestamp":"2026-10-06T14:10:00+07:00",
                     "predictions":[{"technicianId":2,"predictedTechnicalMinutes":55.4,"warnings":[]},
                                    {"technicianId":3,"predictedTechnicalMinutes":70.0,"warnings":["UNSEEN_CATALOG_CATEGORY"]}],
                     "model":{"name":"CatBoostRegressor","version":"v1","status":"EXPERIMENTAL_DEMO",
                              "featureContractVersion":"repair-duration-features-v1.1","syntheticData":true,"productionValidated":false}}
                    """, org.springframework.http.MediaType.APPLICATION_JSON));
        var result = actual.predictCandidates(1L, List.of(2L, 3L), AT);
        assertEquals(2, result.predictions().size());
        assertEquals("EXPERIMENTAL_DEMO", result.model().status());
        server.verify();
    }

    @Test
    void http503AndMalformedResponseAreStructuredFailures() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        var actual = new MlPredictionClient(builder.build(), new MlServiceProperties());
        server.expect(anything()).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertEquals("ML_HTTP_FAILURE", assertThrows(MlServiceUnavailableException.class,
                () -> actual.predictCandidates(1L, List.of(2L), AT)).reasonCode());
        server.verify();
    }

    @Test
    void disabledMlNeverPerformsHttpCall() {
        var properties = new MlServiceProperties();
        properties.setEnabled(false);
        var actual = new MlPredictionClient(RestClient.create(), properties);
        assertEquals("ML_DISABLED", assertThrows(MlServiceUnavailableException.class,
                () -> actual.predictCandidates(1L, List.of(2L), AT)).reasonCode());
    }
}
