package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ServiceTicketStatus;

import java.time.LocalDateTime;

public record ServiceTicketSummaryResponse(Long id, String ticketCode, Long customerDeviceId, Long branchId,
                                           ServiceTicketStatus status, LocalDateTime receivedAt) {
}
