package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.WarrantyDecision;
import jakarta.validation.constraints.NotNull;

public record WarrantyDecisionRequest(
        @NotNull WarrantyDecision decision, String note
) {
}
