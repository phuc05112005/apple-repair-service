package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.InventoryTransactionType;

import java.time.LocalDateTime;

public record InventoryTransactionResponse(
        Long id,
        String transactionCode,
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
    public static String code(Long id, InventoryTransactionType type) {
        String prefix = switch (type) {
            case STOCK_IN, USAGE_RETURN -> "NHAP";
            case STOCK_OUT, USAGE_OUT -> "XUAT";
            case TRANSFER -> "CHUYEN";
        };
        return prefix + "_" + String.format("%06d", id);
    }
}
