package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
public record StockAdjustmentCommand(@NotNull @Positive Long branchId, @NotNull @Positive Long partId,
                                     @NotNull @Positive Integer quantity, @Size(max=5000) String note) {}

