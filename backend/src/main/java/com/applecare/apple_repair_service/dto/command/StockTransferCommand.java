package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
public record StockTransferCommand(@NotNull @Positive Long partId, @NotNull @Positive Long sourceBranchId,
                                   @NotNull @Positive Long destinationBranchId, @NotNull @Positive Integer quantity,
                                   @Size(max=5000) String note) {}

