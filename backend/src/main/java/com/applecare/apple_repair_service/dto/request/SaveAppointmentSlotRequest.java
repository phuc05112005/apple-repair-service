package com.applecare.apple_repair_service.dto.request;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import java.time.LocalTime;
public record SaveAppointmentSlotRequest(@NotNull @Positive Long branchId, @NotNull LocalDate slotDate,
        @NotNull LocalTime startTime, @NotNull LocalTime endTime) {}

