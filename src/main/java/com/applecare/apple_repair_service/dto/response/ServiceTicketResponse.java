package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.PaymentMethod;
import com.applecare.apple_repair_service.enums.PaymentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ServiceTicketResponse(
        Long id,
        String ticketCode,
        Long appointmentDeviceId,
        Long customerDeviceId,
        Long branchId,
        Long createdById,
        ServiceTicketStatus status,
        String receivedCondition,
        String inspectionResult,
        Long inspectedById,
        BigDecimal discountPercent,
        PaymentStatus paymentStatus,
        PaymentMethod paymentMethod,
        LocalDateTime paidAt,
        Long handedOverById,
        LocalDateTime handedOverAt,
        String cancelReason,
        LocalDateTime receivedAt,
        LocalDateTime updatedAt
) {
}
