package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomerInfoRequest(
        @NotBlank @Size(max = 255) String fullName, @NotBlank @Size(max = 255) String phone
) {
}
