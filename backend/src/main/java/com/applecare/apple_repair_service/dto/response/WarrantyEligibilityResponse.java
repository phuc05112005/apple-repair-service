package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDate;

public record WarrantyEligibilityResponse(Long repairItemId, LocalDate warrantyStartDate, LocalDate warrantyEndDate,
                                          boolean eligible, long remainingDays) {
}
