package com.applecare.apple_repair_service.dto.command;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

public record StockInCommand(@NotBlank @Size(max=100) String lotCode,
        @NotNull @Positive Long branchId, @NotNull @Positive Long partId,
        @NotNull @Positive Integer quantity, @NotNull @PastOrPresent LocalDateTime receivedAt,
        @Size(max=5000) String sourceNote) {}
