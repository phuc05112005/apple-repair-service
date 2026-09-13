package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.Valid;

import java.util.List;

public record RecordInspectionRequest(
        @NotBlank String inspectionResult, @NotNull @Positive Long inspectedByUserId,
        @NotNull Boolean requiresCustomerApproval, @NotEmpty List<@NotNull @Valid InspectionRepairItemRequest> items
) {
}
