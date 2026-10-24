package com.applecare.apple_repair_service.dto.publicapi;

public record PublicAppointmentResponse(Long appointmentId, String branchName, java.time.LocalDate date, java.time.LocalTime startTime, java.time.LocalTime endTime, com.applecare.apple_repair_service.enums.AppointmentStatus status, java.math.BigDecimal discountPercent, java.time.LocalDateTime bookedAt, java.util.List<PublicAppointmentDeviceResponse> devices) {
}
