package com.applecare.apple_repair_service.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Component
@Slf4j
public class MlClient {

    private final RestClient restClient;

    public MlClient(
            @Value("${app.ml.base-url:http://localhost:8001}") String baseUrl,
            @Value("${app.ml.connect-timeout:1s}") Duration connectTimeout,
            @Value("${app.ml.read-timeout:3s}") Duration readTimeout
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout((int) connectTimeout.toMillis());
        requestFactory.setReadTimeout((int) readTimeout.toMillis());

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    public record PredictRequest(Long service_ticket_id, Long user_id) {}
    public record PredictResponse(
            String status,
            Long service_ticket_id,
            Integer predicted_duration_minutes,
            String estimated_start_at,
            String estimated_completion_at
    ) {}

    public void predictAndUpdate(Long ticketId, Long userId) {
        try {
            log.info("Triggering ML prediction for Ticket ID: {}", ticketId);
            PredictResponse response = restClient.post()
                    .uri("/api/v1/predict-and-update")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new PredictRequest(ticketId, userId))
                    .retrieve()
                    .body(PredictResponse.class);

            if (response != null && "success".equals(response.status())) {
                log.info("ML Prediction applied successfully for Ticket ID: {}. Duration: {} mins",
                        ticketId, response.predicted_duration_minutes());
            }
        } catch (Exception e) {
            log.error("Failed to call ML Service for Ticket ID: {}. Error: {}", ticketId, e.getMessage());
        }
    }
}