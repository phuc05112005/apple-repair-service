package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.TechnicianScheduleStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;
import java.time.LocalTime;

public record CreateTechnicianScheduleRequest(
        @NotNull @Positive Long technicianId, @NotNull @Positive Long branchId, @NotNull LocalDate workDate,
        @NotNull LocalTime startTime, @NotNull LocalTime endTime, @NotNull TechnicianScheduleStatus status
) {
}
