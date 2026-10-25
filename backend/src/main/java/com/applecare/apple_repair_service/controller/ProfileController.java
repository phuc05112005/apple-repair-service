package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.request.ChangePasswordRequest;
import com.applecare.apple_repair_service.dto.request.UpdateUserProfileRequest;
import com.applecare.apple_repair_service.dto.response.UserResponse;
import com.applecare.apple_repair_service.security.CurrentActor;
import com.applecare.apple_repair_service.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final UserService userService;
    private final CurrentActor actor;

    @GetMapping
    public ResponseEntity<UserResponse> getMyProfile() {
        return ResponseEntity.ok(userService.getById(actor.id()));
    }

    @PutMapping
    public ResponseEntity<UserResponse> updateMyProfile(@Valid @RequestBody UpdateUserProfileRequest request) {
        return ResponseEntity.ok(userService.updateProfile(actor.id(), request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changeMyPassword(@Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(actor.id(), request);
        return ResponseEntity.noContent().build();
    }
}