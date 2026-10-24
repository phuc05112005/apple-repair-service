package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDateTime;

public record SystemSettingResponse(
        Long id,
        String settingKey,
        String settingValue,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
