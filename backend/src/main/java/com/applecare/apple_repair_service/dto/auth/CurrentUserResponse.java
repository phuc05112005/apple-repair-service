package com.applecare.apple_repair_service.dto.auth;
import com.applecare.apple_repair_service.enums.UserRole;
import com.applecare.apple_repair_service.enums.UserStatus;
public record CurrentUserResponse(Long id, String username, String fullName, UserRole role, UserStatus status) {}

