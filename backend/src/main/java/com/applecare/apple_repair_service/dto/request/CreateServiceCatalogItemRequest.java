package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import com.applecare.apple_repair_service.enums.WarrantyRemedy;

public record CreateServiceCatalogItemRequest(
        @NotNull @Positive Long deviceModelId, @NotNull @Positive Long serviceTypeId,
        @NotNull @Positive Long serviceIssueId, @Positive Long partId, @Size(max = 255) String name,
        @DecimalMin("0.00") @Digits(integer = 16, fraction = 2) BigDecimal configuredPrice,
        @NotNull @Positive Integer standardDurationMinutes, @NotNull @PositiveOrZero Integer warrantyDays,
        WarrantyRemedy warrantyRemedy, @Positive Long warrantyReplacementCatalogId
) {
    public CreateServiceCatalogItemRequest(Long deviceModelId, Long serviceTypeId, Long serviceIssueId, Long partId,
            String name, BigDecimal configuredPrice, Integer standardDurationMinutes, Integer warrantyDays) {
        this(deviceModelId, serviceTypeId, serviceIssueId, partId, name, configuredPrice,
                standardDurationMinutes, warrantyDays, null, null);
    }
}
