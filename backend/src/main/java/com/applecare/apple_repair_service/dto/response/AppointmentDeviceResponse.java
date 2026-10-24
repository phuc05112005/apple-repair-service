package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDateTime;

public record AppointmentDeviceResponse(
        Long id,
        Long appointmentId,
        Long deviceModelId,
        String symptomDescription,
        LocalDateTime createdAt
) {
}
