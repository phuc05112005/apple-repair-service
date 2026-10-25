package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record StockInRequest(
        @NotBlank @Size(max=100) String lotCode,
        @NotNull @Positive Long branchId,
        @NotNull @Positive Long partId,
        @NotNull @Positive Integer quantity,
        @Size(max = 255) String supplierName,
        @DecimalMin("0.00") BigDecimal costPrice,
        @NotNull LocalDateTime receivedAt,
        @NotNull @Positive Long receivedByUserId,
        @Size(max=5000) String sourceNote
) {
    // Overloaded constructor để giữ tương thích ngược cho Excel Service & legacy code
    public StockInRequest(String lotCode, Long branchId, Long partId, Integer quantity,
                          LocalDateTime receivedAt, Long receivedByUserId, String sourceNote) {
        this(lotCode, branchId, partId, quantity, null, null, receivedAt, receivedByUserId, sourceNote);
    }
}