package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;

import java.time.LocalDateTime;

public record ServiceTypeResponse(
        Long id,
        ServiceTypeCode code,
        String name,
        ActiveStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
