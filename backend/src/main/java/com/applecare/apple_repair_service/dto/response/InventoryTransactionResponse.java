package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.entity.InventoryTransaction;
import com.applecare.apple_repair_service.enums.InventoryTransactionType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record InventoryTransactionResponse(
        Long id,
        String transactionCode,
        Long partId,
        InventoryTransactionType transactionType,
        Long sourceBranchId,
        Long destinationBranchId,
        Integer quantity,
        BigDecimal costPrice,     // <--- Bổ sung Đơn giá
        String supplierName,    // <--- Bổ sung Nhà cung cấp
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

    // Hàm hỗ trợ map nhanh từ Entity sang DTO Response
    public static InventoryTransactionResponse fromEntity(InventoryTransaction t) {
        return new InventoryTransactionResponse(
                t.getId(),
                code(t.getId(), t.getTransactionType()),
                t.getPart() != null ? t.getPart().getId() : null,
                t.getTransactionType(),
                t.getSourceBranch() != null ? t.getSourceBranch().getId() : null,
                t.getDestinationBranch() != null ? t.getDestinationBranch().getId() : null,
                t.getQuantity(),
                t.getCostPrice(),       // Map cost_price từ DB
                t.getSupplierName(),    // Map supplier_name từ DB
                t.getPartUsage() != null ? t.getPartUsage().getId() : null,
                t.getInventoryLot() != null ? t.getInventoryLot().getId() : null,
                t.getInventoryLot() != null ? t.getInventoryLot().getLotCode() : null,
                t.getRecordedBy() != null ? t.getRecordedBy().getId() : null,
                t.getRecordedBy() != null ? (t.getRecordedBy().getFullName() != null ? t.getRecordedBy().getFullName() : t.getRecordedBy().getUsername()) : null,
                t.getNote(),
                t.getCreatedAt()
        );
    }
}