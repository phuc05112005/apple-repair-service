package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateSystemSettingRequest(
        @NotNull @Size(max = 255) String settingValue
) {
}
