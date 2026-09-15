package com.applecare.apple_repair_service.dto.publicapi;

import com.applecare.apple_repair_service.enums.ServiceTypeCode;

import java.math.BigDecimal;

public record PublicCatalogResponse(
        Long id,
        Long deviceModelId,
        Long serviceIssueId,
        Long serviceTypeId,
        ServiceTypeCode serviceTypeCode,
        String serviceTypeName,
        Long partId,
        String partName,
        String partBrand,
        String partVariant,
        String name,
        BigDecimal configuredPrice,
        BigDecimal displayPrice,
        Integer standardDurationMinutes,
        Integer warrantyDays
) {
}
