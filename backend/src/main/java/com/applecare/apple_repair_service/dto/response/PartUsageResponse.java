package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.PartUsageStatus;

import java.time.LocalDateTime;

public record PartUsageResponse(
        Long id,
        Long repairItemId,
        Long partId,
        Integer quantity,
        PartUsageStatus status,
        Long recordedById,
        LocalDateTime usedAt,
        Long reversedById,
        LocalDateTime reversedAt,
        String reversalNote, String defectiveReturnNote
) {
}
