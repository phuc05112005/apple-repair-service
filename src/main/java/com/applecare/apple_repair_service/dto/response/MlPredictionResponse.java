package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.PredictionType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MlPredictionResponse(
        Long id,
        Long serviceTicketId,
        PredictionType predictionType,
        Integer predictedDurationMinutes,
        Boolean predictedSatisfaction,
        BigDecimal confidence,
        String modelName,
        String modelVersion,
        LocalDateTime predictedAt
) {
}
