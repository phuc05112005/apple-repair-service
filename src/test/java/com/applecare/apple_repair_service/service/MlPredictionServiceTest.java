package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateMlPredictionRequest;
import com.applecare.apple_repair_service.entity.MlPrediction;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.PredictionType;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.MlPredictionRepository;
import jakarta.validation.Validation;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MlPredictionServiceTest {
    final MlPredictionRepository repository = mock(MlPredictionRepository.class);
    final DomainAccess access = mock(DomainAccess.class);
    final List<MlPrediction> saved = new ArrayList<>();
    final MlPredictionService service = new MlPredictionService(repository, access, new BusinessRules(Validation.buildDefaultValidatorFactory().getValidator()), new EntityResponses(), TestData.CLOCK);

    @BeforeEach
    void setup() {
        when(access.get(ServiceTicket.class, 1L)).thenReturn(TestData.ticket(ServiceTicketStatus.REPAIRING));
        when(repository.saveAndFlush(any())).thenAnswer(i -> {
            MlPrediction p = i.getArgument(0);
            assertNull(p.getId());
            p.setId((long) saved.size() + 1);
            saved.add(p);
            return p;
        });
    }

    CreateMlPredictionRequest request(PredictionType type, Integer minutes, Boolean satisfied) {
        return new CreateMlPredictionRequest(1L, type, minutes, satisfied, new BigDecimal("0.9500"), " Model ", " v1 ");
    }

    @Test
    void durationPredictionRequiresPositiveDuration() {
        assertThrows(BusinessRuleViolationException.class, () -> service.savePrediction(request(PredictionType.REPAIR_DURATION, null, null)));
        assertThrows(BusinessRuleViolationException.class, () -> service.savePrediction(request(PredictionType.REPAIR_DURATION, 0, null)));
        assertEquals(60, service.savePrediction(request(PredictionType.REPAIR_DURATION, 60, null)).predictedDurationMinutes());
    }

    @Test
    void satisfactionPredictionRequiresBoolean() {
        assertThrows(BusinessRuleViolationException.class, () -> service.savePrediction(request(PredictionType.CUSTOMER_SATISFACTION, null, null)));
        assertFalse(service.savePrediction(request(PredictionType.CUSTOMER_SATISFACTION, null, false)).predictedSatisfaction());
    }

    @Test
    void mixedPredictionsRejected() {
        assertThrows(BusinessRuleViolationException.class, () -> service.savePrediction(request(PredictionType.REPAIR_DURATION, 20, true)));
        assertThrows(BusinessRuleViolationException.class, () -> service.savePrediction(request(PredictionType.CUSTOMER_SATISFACTION, 20, true)));
    }

    @Test
    void predictionsAlwaysAppend() {
        service.savePrediction(request(PredictionType.REPAIR_DURATION, 30, null));
        service.savePrediction(request(PredictionType.REPAIR_DURATION, 45, null));
        assertEquals(2, saved.size());
        assertNotSame(saved.get(0), saved.get(1));
        assertEquals(30, saved.get(0).getPredictedDurationMinutes());
        assertEquals("Model", saved.get(0).getModelName());
    }
}
