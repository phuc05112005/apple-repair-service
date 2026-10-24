package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.UpdateUserProfileRequest;
import com.applecare.apple_repair_service.dto.request.UpdateUserRoleRequest;
import com.applecare.apple_repair_service.dto.request.UpdateUserStatusRequest;
import com.applecare.apple_repair_service.dto.request.ResetUserPasswordRequest;
import com.applecare.apple_repair_service.dto.response.UserResponse;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.UserRepository;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {
    private final UserRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public UserResponse create(com.applecare.apple_repair_service.dto.request.CreateUserRequest request) {
        rules.validate(request);
        var username = request.username().trim();
        BusinessRules.require(username.length() >= 3, "Tên đăng nhập phải có ít nhất 3 ký tự.");
        BusinessRules.require(request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 72,
                "Mật khẩu không được vượt quá 72 byte UTF-8.");
        if (repository.existsByUsernameIgnoreCase(username))
            throw new com.applecare.apple_repair_service.exception.DuplicateResourceException("Tên đăng nhập đã tồn tại.");
        var user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName().trim());
        user.setPhone(BusinessRules.text(request.phone()));
        user.setRole(request.role());
        user.setStatus(request.status() == null ? com.applecare.apple_repair_service.enums.UserStatus.ACTIVE : request.status());
        try { return mapper.map(repository.saveAndFlush(user)); }
        catch (org.springframework.dao.DataIntegrityViolationException ex) {
            throw new com.applecare.apple_repair_service.exception.DuplicateResourceException("Tên đăng nhập đã tồn tại.");
        }
    }

    public UserResponse getById(Long id) {
        return mapper.map(access.get(User.class, id));
    }

    public List<UserResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public UserResponse updateProfile(Long id, UpdateUserProfileRequest r) {
        rules.validate(r);
        var u = access.lock(User.class, id);
        u.setFullName(r.fullName().trim());
        u.setPhone(BusinessRules.text(r.phone()));
        return mapper.map(u);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public UserResponse updateRole(Long id, UpdateUserRoleRequest r, Long actorId) {
        rules.validate(r);
        BusinessRules.require(!id.equals(actorId) || r.role() == com.applecare.apple_repair_service.enums.UserRole.ADMIN,
                "You cannot remove your own administrator role");
        var u = access.lock(User.class, id);
        u.setRole(r.role());
        return mapper.map(u);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public UserResponse updateStatus(Long id, UpdateUserStatusRequest r, Long actorId) {
        rules.validate(r);
        BusinessRules.require(!id.equals(actorId) || r.status() == com.applecare.apple_repair_service.enums.UserStatus.ACTIVE,
                "You cannot deactivate your own account");
        var u = access.lock(User.class, id);
        u.setStatus(r.status());
        return mapper.map(u);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public void resetPassword(Long id, ResetUserPasswordRequest request) {
        rules.validate(request);
        BusinessRules.require(request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 72,
                "Mật khẩu không được vượt quá 72 byte UTF-8.");
        var user = access.lock(User.class, id);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
    }
}
