package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.config.MlServiceProperties;
import com.applecare.apple_repair_service.dto.response.AdminMlOverviewResponse;
import com.applecare.apple_repair_service.repository.MlPredictionRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.client.RestClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminMlMonitoringService {
    private final MlPredictionRepository predictions;
    private final MlServiceProperties properties;
    @Qualifier("mlRestClient")
    private final RestClient client;

    public AdminMlOverviewResponse overview() {
        var rows = predictions.findAll();
        var durationRows = rows.stream().filter(row -> row.getPredictionType().name().equals("REPAIR_DURATION")).toList();
        var actualRows = durationRows.stream().filter(row -> row.getServiceTicket().getActualRepairStartedAt() != null
                && row.getServiceTicket().getActualRepairCompletedAt() != null).toList();
        var dates = durationRows.stream().map(row -> row.getPredictedAt().toLocalDate()).sorted().toList();
        String status = properties.isEnabled() ? "CONFIGURED" : "DISABLED";
        String health = probe("/health/live");
        String readiness = probe("/health/ready");
        return new AdminMlOverviewResponse(properties.isEnabled(), status,
                health, readiness,
                "CatBoostRegressor", "repair-duration-final-synthetic-v1", "repair-duration-features-v1.1",
                durationRows.size(), actualRows.size(), durationRows.size(), actualRows.size(),
                dates.isEmpty() ? null : dates.get(0), dates.isEmpty() ? null : dates.get(dates.size() - 1));
    }

    private String probe(String path) {
        if (!properties.isEnabled()) return "DISABLED";
        try { client.get().uri(path).retrieve().toBodilessEntity(); return "UP"; }
        catch (RuntimeException ignored) { return "UNAVAILABLE"; }
    }
}
