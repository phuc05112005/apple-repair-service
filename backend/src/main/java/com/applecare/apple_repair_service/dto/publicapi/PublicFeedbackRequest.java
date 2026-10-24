package com.applecare.apple_repair_service.dto.publicapi;

import jakarta.validation.constraints.*;

public record PublicFeedbackRequest(@NotBlank @Size(max = 255) String phone,
                                    @NotNull Boolean satisfied, @Size(max = 5000) String comment) {
}
