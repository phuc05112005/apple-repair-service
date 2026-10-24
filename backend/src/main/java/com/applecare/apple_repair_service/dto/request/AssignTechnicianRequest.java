package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.AssignmentSource;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AssignTechnicianRequest(
        @NotNull @Positive Long technicianId, @NotNull @Positive Long assignedByUserId, @NotNull AssignmentSource source
) {
}
