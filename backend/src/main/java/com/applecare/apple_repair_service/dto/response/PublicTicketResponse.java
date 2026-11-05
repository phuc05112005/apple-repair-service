package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.dto.publicapi.PublicRepairItemResponse;
import com.applecare.apple_repair_service.enums.PaymentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PublicTicketResponse(
        String ticketCode,
        String deviceModelName,
        String branchName,
        ServiceTicketStatus status,
        PaymentStatus paymentStatus,
        BigDecimal approvedTotal,
        LocalDateTime receivedAt,
        LocalDateTime actualRepairStartedAt,
        LocalDateTime estimatedCompletionAt,
        Long estimatedDurationMinutes,
        LocalDateTime handedOverAt,
        List<PublicRepairItemResponse> repairItems,
        List<PublicTechnicianResponse> technicians
) {}