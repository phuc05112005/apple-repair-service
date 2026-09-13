package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {
    private final UserService service;
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) { return service.create(request); }
    @GetMapping
    public List<UserResponse> list() { return service.list(); }
    @GetMapping("/{id}")
    public UserResponse get(@PathVariable @Positive Long id) { return service.getById(id); }
    @PutMapping("/{id}/profile")
    public UserResponse profile(@PathVariable @Positive Long id, @Valid @RequestBody UpdateUserProfileRequest request) {
        return service.updateProfile(id, request);
    }
    @PutMapping("/{id}/role")
    public UserResponse role(@PathVariable @Positive Long id, @Valid @RequestBody UpdateUserRoleRequest request) {
        return service.updateRole(id, request);
    }
    @PutMapping("/{id}/status")
    public UserResponse status(@PathVariable @Positive Long id, @Valid @RequestBody UpdateUserStatusRequest request) {
        return service.updateStatus(id, request);
    }
}

