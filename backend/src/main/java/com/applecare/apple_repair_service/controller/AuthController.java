package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.auth.*;
import com.applecare.apple_repair_service.security.CurrentActor;
import com.applecare.apple_repair_service.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService service;
    private final CurrentActor actor;

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return service.login(request);
    }

    @GetMapping("/me")
    public CurrentUserResponse me() {
        return actor.principal().response();
    }

    // Bổ sung endpoint quên mật khẩu

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        service.forgotPassword(request);
        return ResponseEntity.ok(Map.of("message", "Mật khẩu mới đã được gửi tới email của bạn."));
    }
}