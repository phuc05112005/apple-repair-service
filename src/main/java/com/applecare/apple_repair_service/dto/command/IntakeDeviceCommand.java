package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
public record IntakeDeviceCommand(@Size(max=255) String serialNumber, @Size(max=255) String storage, @NotBlank @Size(max=5000) String receivedCondition) {}
