package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreateWarrantyClaimRequest(
        @NotNull @Positive Long branchId,
        @NotNull @Positive Long serviceCatalogItemId,
        @Size(max = 5000) String ignoredReceivedCondition,
        @NotBlank @Size(max = 5000) String customerReportedIssue,
        @Size(max = 5000) String note,
        @Size(max = 5000) String authorizedScope
) {
    public CreateWarrantyClaimRequest(Long branchId, Long serviceCatalogItemId, String customerReportedIssue,
            String note, String authorizedScope) {
        this(branchId, serviceCatalogItemId, null, customerReportedIssue, note, authorizedScope);
    }
}
