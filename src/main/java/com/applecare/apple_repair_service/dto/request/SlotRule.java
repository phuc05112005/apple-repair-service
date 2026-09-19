package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

public record SlotRule(@NotNull LocalTime startTime, @NotNull LocalTime endTime, boolean enabled) { }
