package com.applecare.apple_repair_service.dto.command;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record StockInCommand(
        @NotBlank @Size(max=100) String lotCode,
        @NotNull @Positive Long branchId,
        @NotNull @Positive Long partId,
        @NotNull @Positive Integer quantity,
        @Size(max = 255) String supplierName,
        @DecimalMin("0.00") BigDecimal costPrice,
        @NotNull LocalDateTime receivedAt,
        @Size(max=5000) String sourceNote
) {
    public StockInCommand(String lotCode, Long branchId, Long partId, Integer quantity,
                          LocalDateTime receivedAt, String sourceNote) {
        this(lotCode, branchId, partId, quantity, null, null, receivedAt, sourceNote);
    }
}