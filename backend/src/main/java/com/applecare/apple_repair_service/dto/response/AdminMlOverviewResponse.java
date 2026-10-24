package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDate;

public record AdminMlOverviewResponse(
        boolean enabled,
        String status,
        String health,
        String readiness,
        String modelName,
        String modelVersion,
        String featureContractVersion,
        long predictionCount,
        long recordsWithActualDuration,
        long recordsWithCompleteFeatures,
        long trainingEligibleRecords,
        LocalDate dataFrom,
        LocalDate dataTo) {}
