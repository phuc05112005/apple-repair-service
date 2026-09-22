package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.ApprovalStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ApprovalDecisionRequest(
        @NotNull ApprovalStatus decision, @NotNull @Positive Long recordedByUserId, String note, com.applecare.apple_repair_service.enums.ConfirmationMethod confirmationMethod
) {
    public ApprovalDecisionRequest(ApprovalStatus decision, Long recordedByUserId, String note) { this(decision, recordedByUserId, note, com.applecare.apple_repair_service.enums.ConfirmationMethod.DIRECT); }
}
