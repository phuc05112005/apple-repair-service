package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
public record TransferCommand(@NotNull @Positive Long targetTechnicianId, @Size(max=5000) String note) {}
