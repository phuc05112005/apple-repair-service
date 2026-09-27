package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.InventoryTransactionType;

import java.time.LocalDateTime;

public record InventoryTransactionResponse(
        Long id,
        Long partId,
        InventoryTransactionType transactionType,
        Long sourceBranchId,
        Long destinationBranchId,
        Integer quantity,
        Long partUsageId,
        Long inventoryLotId,
        String lotCode,
        Long recordedById,
        String recordedByName,
        String note,
        LocalDateTime createdAt
) {
}
