package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CustomerDeviceInfoRequest(
        @NotNull @Positive Long deviceModelId, @Size(max = 255) String serialNumber, @Size(max = 255) String storage
) {
}
