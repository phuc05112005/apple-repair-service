package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
public record PartUsageCommand(@NotNull @Positive Long partId, @NotNull @Positive Integer quantity) {}
