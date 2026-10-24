package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.UserRole;
import com.applecare.apple_repair_service.enums.UserStatus;

import java.time.LocalDateTime;

public record UserResponse(
        Long id,
        String username,
        String fullName,
        String phone,
        UserRole role,
        UserStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
