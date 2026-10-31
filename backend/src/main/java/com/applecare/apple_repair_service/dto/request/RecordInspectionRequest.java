package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;

import java.util.List;

public record RecordInspectionRequest(
        @NotBlank String inspectionResult,
        @NotNull Boolean requiresCustomerApproval,
        @NotEmpty List<@NotNull @Valid InspectionRepairItemRequest> items,
        com.applecare.apple_repair_service.enums.ConfirmationMethod confirmationMethod,
        @jakarta.validation.constraints.Size(max=5000) String confirmationNote
) {
    public RecordInspectionRequest(String inspectionResult, Boolean requiresCustomerApproval, List<InspectionRepairItemRequest> items) {
        this(inspectionResult, requiresCustomerApproval, items, null, null);
    }
}