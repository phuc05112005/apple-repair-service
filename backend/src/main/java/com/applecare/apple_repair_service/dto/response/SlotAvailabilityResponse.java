package com.applecare.apple_repair_service.dto.response;
import com.applecare.apple_repair_service.enums.AppointmentSlotStatus;
import java.time.LocalDate;
import java.time.LocalTime;
public record SlotAvailabilityResponse(Long slotId, Long branchId, LocalDate slotDate, LocalTime startTime,
        LocalTime endTime, AppointmentSlotStatus status, long activeBookingCount) {}

