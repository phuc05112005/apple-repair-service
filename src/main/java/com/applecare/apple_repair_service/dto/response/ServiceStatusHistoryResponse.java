package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ServiceTicketStatus;

import java.time.LocalDateTime;

public record ServiceStatusHistoryResponse(
        Long id,
        Long serviceTicketId,
        ServiceTicketStatus fromStatus,
        ServiceTicketStatus toStatus,
        Long changedById,
        String note,
        LocalDateTime changedAt
) {
}
