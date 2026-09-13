package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreateDeviceModelRequest(
        @NotNull @Positive Long deviceTypeId, @NotBlank @Size(max = 255) String name
) {
}
