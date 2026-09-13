package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateServiceCatalogItemRequest(
        @NotNull @Positive Long deviceModelId, @NotNull @Positive Long serviceTypeId,
        @NotNull @Positive Long serviceIssueId, @Positive Long partId, @NotBlank @Size(max = 255) String name,
        @DecimalMin("0.00") @Digits(integer = 16, fraction = 2) BigDecimal configuredPrice,
        @Positive Integer standardDurationMinutes, @NotNull @PositiveOrZero Integer warrantyDays
) {
}
