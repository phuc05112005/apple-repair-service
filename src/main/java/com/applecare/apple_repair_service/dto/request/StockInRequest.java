package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

public record StockInRequest(@NotBlank @Size(max=100) String lotCode,
        @NotNull @Positive Long branchId, @NotNull @Positive Long partId,
        @NotNull @Positive Integer quantity, @NotNull LocalDateTime receivedAt,
        @NotNull @Positive Long receivedByUserId, @Size(max=5000) String sourceNote) {}
