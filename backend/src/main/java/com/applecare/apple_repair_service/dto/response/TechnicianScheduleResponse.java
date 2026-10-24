package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.TechnicianScheduleStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public record TechnicianScheduleResponse(
        Long id,
        Long technicianId,
        Long branchId,
        LocalDate workDate,
        LocalTime startTime,
        LocalTime endTime,
        TechnicianScheduleStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
