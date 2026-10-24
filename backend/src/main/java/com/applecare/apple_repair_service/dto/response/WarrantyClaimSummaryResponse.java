package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.WarrantyRemedy;
import java.time.LocalDateTime;

public record WarrantyClaimSummaryResponse(
        Long repairItemId, Long ticketId, String ticketCode, ServiceTicketStatus status,
        WarrantyRemedy technicalMethod, LocalDateTime receivedAt, LocalDateTime handedOverAt
) {}
