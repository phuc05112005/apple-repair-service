package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.PaymentMethod;
import jakarta.validation.constraints.NotNull;

public record RecordPaymentRequest(
        @NotNull PaymentMethod paymentMethod
) {
}
