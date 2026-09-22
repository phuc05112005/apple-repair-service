package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.WarrantyDecision;
import jakarta.validation.constraints.NotNull;

public record WarrantyDecisionRequest(
        @NotNull WarrantyDecision decision, String note, com.applecare.apple_repair_service.enums.WarrantyRemedy remedy, @jakarta.validation.constraints.Positive Long replacementCatalogItemId
) {
    public WarrantyDecisionRequest(WarrantyDecision decision, String note) { this(decision, note, com.applecare.apple_repair_service.enums.WarrantyRemedy.REPAIR, null); }
}
