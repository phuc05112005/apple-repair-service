package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record InspectionRepairItemRequest(
        @NotNull @Positive Long serviceCatalogItemId,
        @DecimalMin("0.00") @Digits(integer = 16, fraction = 2) BigDecimal basePrice,
        @DecimalMin("0.00") @Digits(integer = 16, fraction = 2) BigDecimal finalPrice,
        @Positive Long warrantySourceItemId
) {
}
