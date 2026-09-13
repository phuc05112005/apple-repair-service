package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.TransferMode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateTransferRequest(
        @NotNull @Positive Long fromAssignmentId, @NotNull @Positive Long targetTechnicianId,
        @NotNull @Positive Long requestedByUserId, @NotNull TransferMode mode, String note
) {
}
