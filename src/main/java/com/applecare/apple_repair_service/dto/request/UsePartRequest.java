package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record UsePartRequest(
        @NotNull @Positive Long repairItemId, @NotNull @Positive Long partId, @NotNull @Positive Integer quantity,
        @NotNull @Positive Long recordedByUserId
) {
}
