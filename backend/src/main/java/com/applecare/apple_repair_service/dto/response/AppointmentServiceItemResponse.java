package com.applecare.apple_repair_service.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AppointmentServiceItemResponse(
        Long id,
        Long appointmentDeviceId,
        Long serviceCatalogItemId,
        Long warrantySourceItemId,
        String serviceNameSnapshot,
        BigDecimal basePriceSnapshot,
        BigDecimal finalPriceSnapshot,
        LocalDateTime createdAt
) {
}
