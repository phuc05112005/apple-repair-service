package com.applecare.apple_repair_service.dto.publicapi;

public record PublicCatalogResponse(Long id, Long deviceModelId, Long serviceIssueId, Long serviceTypeId, String name, java.math.BigDecimal configuredPrice, Integer standardDurationMinutes, Integer warrantyDays) {
}
