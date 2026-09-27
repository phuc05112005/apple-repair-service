package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.TransferMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreateTransferRequest(
        @NotNull @Positive Long fromAssignmentId, @NotNull @Positive Long targetTechnicianId,
        @NotNull @Positive Long requestedByUserId, @NotNull TransferMode mode,
        @NotBlank @Size(max = 5000) String note,
        @NotBlank @Size(max = 5000) String workDone,
        @NotBlank @Size(max = 5000) String currentCondition
) {
}
