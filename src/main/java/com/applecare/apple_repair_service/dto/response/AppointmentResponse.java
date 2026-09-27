package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.AppointmentStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.LocalTime;

public record AppointmentResponse(
        Long id,
        Long customerId,
        String customerFullName,
        String customerPhone,
        Long appointmentSlotId,
        AppointmentStatus status,
        BigDecimal discountPercent,
        Long confirmedById,
        LocalDateTime confirmedAt,
        LocalDate appointmentDate,
        LocalTime slotStartTime,
        LocalTime slotEndTime,
        LocalDateTime arrivedAt,
        String note,
        String cancelReason,
        LocalDateTime bookedAt,
        LocalDateTime updatedAt
) {
}
