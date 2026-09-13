package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public record WalkInIntakeRequest(
        @NotBlank @Size(max = 255) String customerFullName, @NotBlank @Size(max = 255) String phone,
        @NotNull @Positive Long branchId, @NotNull @Positive Long deviceModelId, @Size(max = 255) String serialNumber,
        @Size(max = 255) String storage, @NotBlank String receivedCondition,
        List<@NotNull @Positive Long> serviceCatalogItemIds
) {
}
