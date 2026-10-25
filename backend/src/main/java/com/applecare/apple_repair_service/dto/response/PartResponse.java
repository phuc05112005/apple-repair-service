package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ActiveStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PartResponse(
        Long id,
        List<Long> deviceModelIds,
        Long serviceIssueId,
        String partCode,
        String name,
        String brand,
        String variant,
        String origin,
        String manufacturer,
        String supplier,
        BigDecimal salePrice,
        ActiveStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}