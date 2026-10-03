package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.PredictionType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateMlPredictionRequest(
        @NotNull @Positive Long serviceTicketId, @Positive Long technicianId,
        @NotNull PredictionType predictionType,
        @Positive Integer predictedDurationMinutes, Boolean predictedSatisfaction,
        @DecimalMin("0.0000") @DecimalMax("1.0000") @Digits(integer = 1, fraction = 4) BigDecimal confidence,
        @NotBlank @Size(max = 255) String modelName, @NotBlank @Size(max = 255) String modelVersion
) {
    public CreateMlPredictionRequest(
            Long serviceTicketId, PredictionType predictionType,
            Integer predictedDurationMinutes, Boolean predictedSatisfaction,
            BigDecimal confidence, String modelName, String modelVersion) {
        this(serviceTicketId, null, predictionType, predictedDurationMinutes,
                predictedSatisfaction, confidence, modelName, modelVersion);
    }
}
