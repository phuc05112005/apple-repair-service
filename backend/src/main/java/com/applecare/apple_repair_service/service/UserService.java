package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.ChangePasswordRequest;
import com.applecare.apple_repair_service.dto.request.CreateUserRequest;
import com.applecare.apple_repair_service.dto.request.ResetUserPasswordRequest;
import com.applecare.apple_repair_service.dto.request.UpdateUserProfileRequest;
import com.applecare.apple_repair_service.dto.request.UpdateUserRoleRequest;
import com.applecare.apple_repair_service.dto.request.UpdateUserStatusRequest;
import com.applecare.apple_repair_service.dto.response.UserResponse;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.UserStatus;
import com.applecare.apple_repair_service.exception.DuplicateResourceException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;
    private final PasswordEncoder passwordEncoder;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public UserResponse create(CreateUserRequest request) {
        rules.validate(request);
        var username = request.username().trim();
        BusinessRules.require(username.length() >= 3, "Tên đăng nhập phải có ít nhất 3 ký tự.");
        BusinessRules.require(request.password().getBytes(StandardCharsets.UTF_8).length <= 72,
                "Mật khẩu không được vượt quá 72 byte UTF-8.");

        if (repository.existsByUsernameIgnoreCase(username)) {
            throw new DuplicateResourceException("Tên đăng nhập đã tồn tại.");
        }

        var user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName().trim());
        user.setPhone(BusinessRules.text(request.phone()));
        user.setRole(request.role());
        user.setStatus(request.status() == null ? UserStatus.ACTIVE : request.status());
        user.setMustChangePassword(false);
        user.setFailedLoginAttempts(0);

        try {
            return mapper.map(repository.saveAndFlush(user));
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateResourceException("Tên đăng nhập hoặc Email đã tồn tại.");
        }
    }

    public UserResponse getById(Long id) {
        return mapper.map(access.get(User.class, id));
    }

    public List<UserResponse> list() {
        return repository.findAll().stream().map(mapper::map).toList();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public UserResponse updateProfile(Long id, UpdateUserProfileRequest r) {
        rules.validate(r);
        var u = access.lock(User.class, id);

        // Check trùng lặp Email với user khác
        if (r.email() != null && !r.email().isBlank()) {
            var emailFormatted = r.email().trim();
            repository.findByEmail(emailFormatted).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new DuplicateResourceException("Email đã được sử dụng bởi tài khoản khác.");
                }
            });
            u.setEmail(emailFormatted);
        } else {
            u.setEmail(null);
        }

        u.setFullName(r.fullName().trim());
        u.setPhone(BusinessRules.text(r.phone()));
        return mapper.map(u);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public UserResponse updateRole(Long id, UpdateUserRoleRequest r, Long actorId) {
        rules.validate(r);
        BusinessRules.require(!id.equals(actorId) || r.role() == com.applecare.apple_repair_service.enums.UserRole.ADMIN,
                "You cannot remove your own administrator role");
        var u = access.lock(User.class, id);
        u.setRole(r.role());
        return mapper.map(u);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public UserResponse updateStatus(Long id, UpdateUserStatusRequest r, Long actorId) {
        rules.validate(r);
        BusinessRules.require(!id.equals(actorId) || r.status() == UserStatus.ACTIVE,
                "You cannot deactivate your own account");
        var u = access.lock(User.class, id);
        u.setStatus(r.status());
        if (r.status() == UserStatus.ACTIVE) {
            u.setFailedLoginAttempts(0);
            u.setLockedUntil(null);
        }
        return mapper.map(u);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void resetPassword(Long id, ResetUserPasswordRequest request) {
        rules.validate(request);
        BusinessRules.require(request.password().getBytes(StandardCharsets.UTF_8).length <= 72,
                "Mật khẩu không được vượt quá 72 byte UTF-8.");
        var user = access.lock(User.class, id);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setMustChangePassword(true); // Bắt buộc user đổi mật khẩu ở lần đăng nhập tiếp theo
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setPasswordChangedAt(LocalDateTime.now());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void changePassword(Long userId, ChangePasswordRequest request) {
        rules.validate(request);
        BusinessRules.require(request.newPassword().getBytes(StandardCharsets.UTF_8).length <= 72,
                "Mật khẩu không được vượt quá 72 byte UTF-8.");

        var user = access.lock(User.class, userId);

        // 1. Kiểm tra mật khẩu hiện tại
        BusinessRules.require(passwordEncoder.matches(request.currentPassword(), user.getPasswordHash()),
                "Mật khẩu hiện tại không chính xác.");

        // 2. Mật khẩu mới và xác nhận trùng nhau
        BusinessRules.require(request.newPassword().equals(request.confirmPassword()),
                "Mật khẩu mới và xác nhận mật khẩu không trùng khớp.");

        // 3. Không trùng mật khẩu cũ
        BusinessRules.require(!passwordEncoder.matches(request.newPassword(), user.getPasswordHash()),
                "Mật khẩu mới không được giống mật khẩu hiện tại.");

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setMustChangePassword(false);
        user.setPasswordChangedAt(LocalDateTime.now());
    }
}