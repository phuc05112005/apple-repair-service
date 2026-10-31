package com.applecare.apple_repair_service.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AdminTicketSummaryResponse(
        Long id,
        String ticketCode,
        String customerFullName,
        String customerPhone,
        String deviceModelName,
        String imeiOrSerial,
        Long branchId,
        String branchName,
        String technicianName,
        BigDecimal totalAmount,
        String status,
        LocalDateTime receivedAt,
        String serviceType
) {
}