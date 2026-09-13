package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
public record AssignTechnicianCommand(@NotNull @Positive Long technicianId, @NotNull com.applecare.apple_repair_service.enums.AssignmentSource source) {}
