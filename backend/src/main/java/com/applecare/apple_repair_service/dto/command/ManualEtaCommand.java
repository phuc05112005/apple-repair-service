package com.applecare.apple_repair_service.dto.command;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
public record ManualEtaCommand(@NotNull LocalDateTime estimatedStartAt,@NotNull LocalDateTime estimatedCompletionAt,
 @NotNull @Positive @Max(10080) Long estimatedDurationMinutes,@NotBlank @Size(max=5000) String reason) {}
