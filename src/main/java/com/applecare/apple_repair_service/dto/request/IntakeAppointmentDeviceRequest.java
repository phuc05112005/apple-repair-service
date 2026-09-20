package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record IntakeAppointmentDeviceRequest(
        @NotNull @Positive Long appointmentDeviceId, @Size(max = 255) String serialNumber,
        @Size(max = 255) String storage, @NotBlank String receivedCondition,
        @Size(min = 1, max = 10) List<@NotNull @Positive Long> serviceCatalogItemIds,
        @NotNull @Positive Long createdByUserId
) {
    public IntakeAppointmentDeviceRequest(Long appointmentDeviceId, String serialNumber, String storage,
                                          String receivedCondition, Long createdByUserId) {
        this(appointmentDeviceId, serialNumber, storage, receivedCondition, null, createdByUserId);
    }
}
