package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record IntakeAppointmentDeviceRequest(
        @NotNull @Positive Long appointmentDeviceId, @Size(max = 255) String serialNumber,
        @Size(max = 255) String storage, @Size(max = 5000) String receivedCondition,
        @Size(min = 1, max = 10) List<@NotNull @Positive Long> serviceCatalogItemIds,
        @NotNull @Positive Long createdByUserId
) {
    public IntakeAppointmentDeviceRequest(Long appointmentDeviceId, String serialNumber, String storage,
                                          List<Long> serviceCatalogItemIds, Long createdByUserId) {
        this(appointmentDeviceId, serialNumber, storage, null, serviceCatalogItemIds, createdByUserId);
    }

    public IntakeAppointmentDeviceRequest(Long appointmentDeviceId, String serialNumber, String storage,
                                          String ignoredReceivedCondition, Long createdByUserId) {
        this(appointmentDeviceId, serialNumber, storage, null, null, createdByUserId);
    }

}
