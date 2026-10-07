package com.applecare.apple_repair_service.integration.ml;

import com.applecare.apple_repair_service.config.MlServiceProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
@Slf4j
public class MlPredictionClient {
    private final RestClient client;
    private final MlServiceProperties properties;

    public MlPredictionClient(@Qualifier("mlRestClient") RestClient client, MlServiceProperties properties) {
        this.client = client;
        this.properties = properties;
    }

    public BatchResponse predictCandidates(long ticketId, List<Long> technicianIds, OffsetDateTime evaluationTimestamp) {
        if (!properties.isEnabled()) throw new MlServiceUnavailableException("ML_DISABLED", "ML integration is disabled");
        var started = System.nanoTime();
        try {
            var response = client.post().uri("/api/v1/repair-duration/predict-candidates")
                    .body(new BatchRequest(ticketId, technicianIds, evaluationTimestamp)).retrieve().body(BatchResponse.class);
            validate(ticketId, technicianIds, response);
            log.info("ML prediction succeeded ticketId={} candidateCount={} latencyMs={} modelVersion={}",
                    ticketId, technicianIds.size(), elapsedMillis(started), response.model().version());
            return response;
        } catch (MlServiceUnavailableException exception) {
            throw exception;
        } catch (RestClientException exception) {
            log.warn("ML prediction unavailable ticketId={} candidateCount={} latencyMs={} errorType={}",
                    ticketId, technicianIds.size(), elapsedMillis(started), exception.getClass().getSimpleName());
            throw new MlServiceUnavailableException("ML_HTTP_FAILURE", "ML service is unavailable", exception);
        } catch (RuntimeException exception) {
            log.warn("ML response invalid ticketId={} candidateCount={} latencyMs={}",
                    ticketId, technicianIds.size(), elapsedMillis(started));
            throw new MlServiceUnavailableException("INVALID_ML_RESPONSE", "ML response is invalid", exception);
        }
    }

    private void validate(long ticketId, List<Long> requested, BatchResponse response) {
        if (response == null || response.ticketId() == null || response.ticketId() != ticketId
                || response.predictions() == null || response.model() == null
                || response.model().name() == null || response.model().version() == null
                || response.model().status() == null || response.model().featureContractVersion() == null)
            throw new MlServiceUnavailableException("INVALID_ML_RESPONSE", "ML response metadata is incomplete");
        var seen = new HashSet<Long>();
        for (var prediction : response.predictions()) {
            if (prediction == null || prediction.technicianId() == null || !requested.contains(prediction.technicianId())
                    || !seen.add(prediction.technicianId()) || prediction.predictedTechnicalMinutes() == null
                    || !Double.isFinite(prediction.predictedTechnicalMinutes()) || prediction.predictedTechnicalMinutes() <= 0)
                throw new MlServiceUnavailableException("INVALID_ML_RESPONSE", "ML candidate prediction is invalid");
        }
    }

    private static long elapsedMillis(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }

    public record BatchRequest(long ticketId, List<Long> candidateTechnicianIds, OffsetDateTime evaluationTimestamp) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BatchResponse(Long ticketId, OffsetDateTime evaluationTimestamp,
                                List<CandidatePrediction> predictions, ModelMetadata model) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CandidatePrediction(Long technicianId, Double predictedTechnicalMinutes, List<String> warnings) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ModelMetadata(String name, String version, String status, String featureContractVersion,
                                Boolean syntheticData, Boolean productionValidated) {}
}
