package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record SaveWeeklyScheduleRequest(@NotNull @Positive Long branchId, @NotNull Integer weekday,
        boolean enabled, @NotNull List<@Valid SlotRule> slots) { }
