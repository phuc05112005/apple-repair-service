package com.applecare.apple_repair_service.integration.ml;

import com.applecare.apple_repair_service.config.MlServiceProperties;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MlFastApiContractSmokeTest {

    @Test
    @EnabledIfEnvironmentVariable(named = "RUN_ML_CONTRACT_SMOKE", matches = "true")
    void springClientReachesRealFastApiUsingFrozenRequestContract() {
        var properties = new MlServiceProperties();
        properties.setEnabled(true);
        properties.setBaseUrl(System.getenv().getOrDefault("ML_SERVICE_BASE_URL", "http://127.0.0.1:8001"));
        properties.setConnectTimeout(Duration.ofSeconds(1));
        properties.setReadTimeout(Duration.ofSeconds(3));
        var requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(properties.getConnectTimeout());
        requestFactory.setReadTimeout(properties.getReadTimeout());
        var client = new MlPredictionClient(
                RestClient.builder().baseUrl(properties.getBaseUrl()).requestFactory(requestFactory).build(),
                properties);

        var exception = assertThrows(MlServiceUnavailableException.class,
                () -> client.predictCandidates(999_999_999L, List.of(1L),
                        OffsetDateTime.parse("2026-10-06T23:00:00+07:00")));

        assertEquals("ML_HTTP_FAILURE", exception.reasonCode());
    }
}
