package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.UserStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateUserStatusRequest(
        @NotNull UserStatus status
) {
}
