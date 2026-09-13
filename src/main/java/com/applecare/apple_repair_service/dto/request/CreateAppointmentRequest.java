package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;

import java.util.List;

public record CreateAppointmentRequest(
        @NotBlank @Size(max = 255) String customerFullName, @NotBlank @Size(max = 255) String phone,
        @NotNull @Positive Long appointmentSlotId, String note,
        @NotEmpty List<@NotNull @Valid AppointmentDeviceRequest> devices
) {
}
