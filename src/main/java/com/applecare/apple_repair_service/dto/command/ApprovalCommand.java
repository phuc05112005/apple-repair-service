package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
public record ApprovalCommand(@NotNull com.applecare.apple_repair_service.enums.ApprovalStatus decision, @Size(max=5000) String note) {}
