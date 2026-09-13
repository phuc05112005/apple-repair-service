package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.Valid;

import java.util.List;

public record AppointmentDeviceRequest(
        @NotNull @Positive Long deviceModelId, String symptomDescription,
        @NotEmpty List<@NotNull @Valid AppointmentServiceItemRequest> serviceItems
) {
}
