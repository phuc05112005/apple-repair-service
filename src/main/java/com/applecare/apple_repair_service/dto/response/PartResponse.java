package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ActiveStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PartResponse(
        Long id,
        String partCode,
        String name,
        String brand,
        String variant,
        BigDecimal salePrice,
        ActiveStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
