package com.applecare.apple_repair_service.dto.command;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record TransferCommand(
        @NotNull @Positive Long targetTechnicianId,
        @NotBlank @Size(max = 5000) String note,
        @NotBlank @Size(max = 5000) String workDone,
        @NotBlank @Size(max = 5000) String currentCondition
) {
}
