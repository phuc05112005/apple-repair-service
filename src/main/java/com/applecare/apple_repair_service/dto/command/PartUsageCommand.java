package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
public record PartUsageCommand(@NotNull @Positive Long partId, @NotNull @Positive Integer quantity, @Size(max=5000) String defectiveReturnNote, @jakarta.validation.constraints.Positive Long defectivePartId) {
    public PartUsageCommand(Long partId, Integer quantity) { this(partId, quantity, null, null); }
 public PartUsageCommand(Long partId, Integer quantity, String defectiveReturnNote) { this(partId, quantity, defectiveReturnNote, null); }
}
