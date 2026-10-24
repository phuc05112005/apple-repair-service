package com.applecare.apple_repair_service.dto.auth;
import java.time.Instant;
public record LoginResponse(String accessToken, String tokenType, Instant expiresAt, CurrentUserResponse user) {
    @Override public String toString() { return "LoginResponse[token redacted]"; }
}

