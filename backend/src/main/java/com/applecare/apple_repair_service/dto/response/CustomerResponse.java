package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDateTime;

public record CustomerResponse(
        Long id,
        String fullName,
        String phone,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
