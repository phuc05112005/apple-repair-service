package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.PaymentMethod;
import com.applecare.apple_repair_service.enums.PaymentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ServiceTicketResponse(
        Long id,
        String ticketCode,
        Long appointmentDeviceId,
        Long customerDeviceId,
        Long branchId,
        @JsonProperty("createdById") Long createdByUserId,
        ServiceTicketStatus status,
        String receivedCondition,
        String inspectionResult,
        BigDecimal discountPercent,
        PaymentStatus paymentStatus,
        PaymentMethod paymentMethod,
        LocalDateTime paidAt,
        Long handedOverByUserId,
        LocalDateTime handedOverAt,
        String cancelReason,
        LocalDateTime receivedAt,
        LocalDateTime updatedAt,
        String authorizedScope,
        TicketTimingResponse timing,
        List<PublicTechnicianResponse> technicians
) {}