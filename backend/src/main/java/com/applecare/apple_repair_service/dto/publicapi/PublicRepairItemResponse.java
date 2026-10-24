package com.applecare.apple_repair_service.dto.publicapi;

import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.enums.WarrantyDecision;
import com.applecare.apple_repair_service.enums.WarrantyRemedy;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PublicRepairItemResponse(
        Long repairItemId,
        Long deviceTypeId,
        Long deviceModelId,
        Long serviceIssueId,
        Long serviceCatalogItemId,
        ServiceTypeCode serviceTypeCode,
        String serviceTypeName,
        Long partId,
        String partName,
        String partBrand,
        String partVariant,
        String name,
        ApprovalStatus approvalStatus,
        BigDecimal finalPrice,
        LocalDate warrantyStartDate,
        LocalDate warrantyEndDate,
        WarrantyDecision warrantyDecision,
        WarrantyRemedy warrantyRemedy,
        Long warrantySourceItemId
) {
}
