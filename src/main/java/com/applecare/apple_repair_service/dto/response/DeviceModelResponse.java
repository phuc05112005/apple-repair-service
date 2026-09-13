package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ActiveStatus;

import java.time.LocalDateTime;

public record DeviceModelResponse(
        Long id,
        Long deviceTypeId,
        String name,
        ActiveStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
