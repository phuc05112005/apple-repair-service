package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ActiveStatus;

import java.time.LocalDateTime;
import java.util.Set;

public record ServiceIssueResponse(
        Long id,
        String name,
        ActiveStatus status,
        Set<Long> deviceTypeIds,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
