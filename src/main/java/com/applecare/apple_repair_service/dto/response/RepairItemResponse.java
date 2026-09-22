package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.WarrantyDecision;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record RepairItemResponse(
        Long id,
        Long serviceTicketId,
        Long serviceCatalogItemId,
        String itemNameSnapshot,
        ApprovalStatus approvalStatus,
        BigDecimal basePrice,
        BigDecimal finalPrice,
        Long approvalRecordedById,
        LocalDateTime approvalDecisionAt,
        String approvalNote,
        LocalDate warrantyStartDate,
        LocalDate warrantyEndDate,
        Long warrantySourceItemId,
        WarrantyDecision warrantyDecision,
        String warrantyDecisionNote,
        LocalDateTime createdAt,
        LocalDateTime updatedAt, com.applecare.apple_repair_service.enums.ConfirmationMethod confirmationMethod,
        com.applecare.apple_repair_service.enums.WarrantyRemedy warrantyRemedy, Long warrantyReplacementCatalogId, Long expectedPartId
) {
}
