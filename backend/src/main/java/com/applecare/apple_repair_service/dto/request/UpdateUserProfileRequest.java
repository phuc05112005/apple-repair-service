package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateUserProfileRequest(
        @NotBlank @Size(max = 255) String fullName,
        @Size(max = 255) String phone,
        @Email @Size(max = 255) String email
) {
}