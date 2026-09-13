package com.applecare.apple_repair_service.dto.publicapi;

public record PublicRepairItemResponse(Long repairItemId, String name, com.applecare.apple_repair_service.enums.ApprovalStatus approvalStatus, java.math.BigDecimal finalPrice, java.time.LocalDate warrantyStartDate, java.time.LocalDate warrantyEndDate, com.applecare.apple_repair_service.enums.WarrantyDecision warrantyDecision) {
}
