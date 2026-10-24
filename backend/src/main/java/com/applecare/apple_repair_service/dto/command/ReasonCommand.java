package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
public record ReasonCommand(@NotBlank @Size(max=5000) String reason) {}
