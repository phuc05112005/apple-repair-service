package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateDeviceTypeRequest(
        @NotBlank @Size(max = 255) String name
) {
}
