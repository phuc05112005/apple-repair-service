package com.applecare.apple_repair_service.dto.request;
import com.applecare.apple_repair_service.enums.UserRole;
import jakarta.validation.constraints.*;
public record CreateUserRequest(@NotBlank @Size(min=3,max=100) String username,
        @NotBlank @Size(min=10,max=72) String password, @NotBlank @Size(max=255) String fullName,
        @Size(max=255) String phone, @NotNull UserRole role) {
    @Override public String toString() { return "CreateUserRequest[credentials redacted]"; }
}

