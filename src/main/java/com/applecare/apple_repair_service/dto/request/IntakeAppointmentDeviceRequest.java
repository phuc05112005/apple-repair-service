package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record IntakeAppointmentDeviceRequest(
        @NotNull @Positive Long appointmentDeviceId, @Size(max = 255) String serialNumber,
        @Size(max = 255) String storage, @NotBlank String receivedCondition, @NotNull @Positive Long createdByUserId
) {
}
