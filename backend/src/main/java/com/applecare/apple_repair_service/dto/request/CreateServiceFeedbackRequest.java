package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateServiceFeedbackRequest(
        @NotNull @Positive Long serviceTicketId, @NotNull Boolean satisfied, String comment
) {
}
