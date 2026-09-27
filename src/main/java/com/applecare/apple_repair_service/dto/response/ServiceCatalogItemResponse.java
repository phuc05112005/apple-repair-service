package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.WarrantyRemedy;

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
        WarrantyRemedy warrantyRemedy,
        Long warrantyReplacementCatalogId,
        ActiveStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
