package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ConfirmAppointmentRequest(
        @NotNull @Positive Long confirmedByUserId
) {
}
