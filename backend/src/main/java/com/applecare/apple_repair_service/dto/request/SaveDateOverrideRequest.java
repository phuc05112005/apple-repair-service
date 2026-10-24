package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import java.util.List;

public record SaveDateOverrideRequest(@NotNull @Positive Long branchId, @NotNull LocalDate date,
        @NotNull String mode, @NotNull List<@Valid SlotRule> slots) { }
