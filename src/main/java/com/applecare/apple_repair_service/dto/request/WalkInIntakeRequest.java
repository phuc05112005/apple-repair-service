package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public record WalkInIntakeRequest(
        @NotBlank @Size(max = 255) String customerFullName, @NotBlank @Size(max = 255) String phone,
        @NotNull @Positive Long branchId, @NotNull @Positive Long deviceModelId, @Size(max = 255) String serialNumber,
        @Size(max = 255) String storage, @NotBlank String receivedCondition,
        @NotEmpty @Size(max = 10) List<@NotNull @Positive Long> serviceCatalogItemIds,
        @Size(max = 5000) String customerReportedIssue, @Size(max = 5000) String authorizedScope
) {
    public WalkInIntakeRequest(String customerFullName, String phone, Long branchId, Long deviceModelId,
            String serialNumber, String storage, String receivedCondition, List<Long> serviceCatalogItemIds, String customerReportedIssue) {
        this(customerFullName, phone, branchId, deviceModelId, serialNumber, storage, receivedCondition, serviceCatalogItemIds, customerReportedIssue, null);
    }
    public WalkInIntakeRequest(String customerFullName, String phone, Long branchId, Long deviceModelId,
                              String serialNumber, String storage, String receivedCondition, List<Long> serviceCatalogItemIds) {
        this(customerFullName, phone, branchId, deviceModelId, serialNumber, storage, receivedCondition, serviceCatalogItemIds, null, null);
    }
}
