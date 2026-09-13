package com.applecare.apple_repair_service.dto.error;
import java.time.Instant;
import java.util.List;
public record ApiErrorResponse(Instant timestamp, int status, String error, String code, String message,
        String path, List<FieldErrorResponse> fieldErrors) {}

