package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
public record WaitResolutionCommand(LocalDateTime resolvedAt, @Size(max=5000) String note) {}
