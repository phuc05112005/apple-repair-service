package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.AppointmentStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AppointmentResponse(
        Long id,
        Long customerId,
        Long appointmentSlotId,
        AppointmentStatus status,
        BigDecimal discountPercent,
        Long confirmedById,
        LocalDateTime confirmedAt,
        String note,
        String cancelReason,
        LocalDateTime bookedAt,
        LocalDateTime updatedAt
) {
}
