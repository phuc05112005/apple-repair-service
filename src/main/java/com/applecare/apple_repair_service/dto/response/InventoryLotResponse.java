package com.applecare.apple_repair_service.dto.response;
import java.time.LocalDateTime;
public record InventoryLotResponse(Long id, String lotCode, Long branchId, Long partId,
        Integer receivedQuantity, LocalDateTime receivedAt, Long receivedById,
        String sourceNote, LocalDateTime createdAt) {}
