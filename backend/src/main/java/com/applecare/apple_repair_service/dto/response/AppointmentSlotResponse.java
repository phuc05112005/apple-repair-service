package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.AppointmentSlotStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public record AppointmentSlotResponse(
        Long id,
        Long branchId,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime,
        AppointmentSlotStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
