package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.UserRole;
import jakarta.validation.constraints.NotNull;

public record UpdateUserRoleRequest(
        @NotNull UserRole role
) {
}
