package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ActiveStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ServiceCatalogItemResponse(
        Long id,
        Long deviceModelId,
        Long serviceTypeId,
        Long serviceIssueId,
        Long partId,
        String name,
        BigDecimal configuredPrice,
        Integer standardDurationMinutes,
        Integer warrantyDays,
        ActiveStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
