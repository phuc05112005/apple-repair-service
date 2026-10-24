package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record UsePartRequest(
        @NotNull @Positive Long repairItemId, @NotNull @Positive Long partId, @NotNull @Positive Integer quantity,
        @NotNull @Positive Long recordedByUserId, @jakarta.validation.constraints.Size(max=5000) String defectiveReturnNote, @jakarta.validation.constraints.Positive Long defectivePartId
) {
    public UsePartRequest(Long repairItemId, Long partId, Integer quantity, Long recordedByUserId) { this(repairItemId, partId, quantity, recordedByUserId, null, null); }
 public UsePartRequest(Long repairItemId, Long partId, Integer quantity, Long recordedByUserId, String defectiveReturnNote) { this(repairItemId, partId, quantity, recordedByUserId, defectiveReturnNote, null); }
}
