package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record TransferStockRequest(
        @NotNull @Positive Long partId, @NotNull @Positive Long sourceBranchId,
        @NotNull @Positive Long destinationBranchId, @NotNull @Positive Integer quantity,
        @NotNull @Positive Long recordedByUserId, String note
) {
}
