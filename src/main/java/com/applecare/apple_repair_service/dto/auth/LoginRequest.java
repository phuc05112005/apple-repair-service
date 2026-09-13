package com.applecare.apple_repair_service.dto.auth;
import jakarta.validation.constraints.*;
public record LoginRequest(@NotBlank @Size(max=255) String username, @NotBlank @Size(max=72) String password) {
    @Override public String toString() { return "LoginRequest[credentials redacted]"; }
}

