package com.applecare.apple_repair_service.dto.command;
import com.applecare.apple_repair_service.enums.DefectivePartStatus;
import jakarta.validation.constraints.*;
public record DefectiveStatusCommand(@NotNull DefectivePartStatus status,@NotBlank @Size(max=5000) String note) {}
