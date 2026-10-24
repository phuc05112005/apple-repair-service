package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateServiceTypeRequest(
        @NotNull ServiceTypeCode code, @NotBlank @Size(max = 255) String name
) {
}
