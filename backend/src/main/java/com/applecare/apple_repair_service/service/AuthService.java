package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.auth.ForgotPasswordRequest;
import com.applecare.apple_repair_service.dto.auth.LoginRequest;
import com.applecare.apple_repair_service.dto.auth.LoginResponse;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.UserStatus;
import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import com.applecare.apple_repair_service.repository.UserRepository;
import com.applecare.apple_repair_service.security.JwtTokenService;
import com.applecare.apple_repair_service.security.UserPrincipal;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenService tokens;
    private final BusinessRules rules;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public LoginResponse login(LoginRequest request) {
        rules.validate(request);
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BadCredentialsException("Invalid credentials");
        }

        var username = request.username().trim();

        // 1. Kiểm tra tài khoản trong DB để xử lý Lockout
        var userEntity = userRepository.findByUsername(username).orElse(null);
        if (userEntity != null) {
            if (userEntity.getStatus() == UserStatus.INACTIVE) {
                throw new LockedException("Tài khoản đã bị vô hiệu hóa.");
            }
            if (userEntity.getLockedUntil() != null && userEntity.getLockedUntil().isAfter(LocalDateTime.now())) {
                throw new LockedException("Tài khoản bị khóa do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau.");
            }
        }

        try {
            // 2. Thử Authenticate
            var authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(username, request.password())
            );

            var userPrincipal = (UserPrincipal) authentication.getPrincipal();

            // 3. Đăng nhập thành công -> Reset số lần nhập sai
            if (userEntity != null) {
                userEntity.setFailedLoginAttempts(0);
                userEntity.setLockedUntil(null);
                userRepository.save(userEntity);
            }

            var token = tokens.issue(userPrincipal);
            return new LoginResponse(token.getTokenValue(), "Bearer", token.getExpiresAt(), userPrincipal.response());

        } catch (BadCredentialsException ex) {
            // 4. Nhập sai mật khẩu -> Tăng số lần sai & Tự khóa nếu >= 5 lần
            if (userEntity != null) {
                int attempts = (userEntity.getFailedLoginAttempts() == null ? 0 : userEntity.getFailedLoginAttempts()) + 1;
                userEntity.setFailedLoginAttempts(attempts);
                if (attempts >= 5) {
                    userEntity.setLockedUntil(LocalDateTime.now().plusMinutes(15)); // Khóa 15 phút
                }
                userRepository.save(userEntity);
            }
            throw new BadCredentialsException("Tên đăng nhập hoặc mật khẩu không chính xác.");
        }
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public void forgotPassword(ForgotPasswordRequest request) {
        rules.validate(request);
        var emailFormatted = request.email().trim();

        // 1. Kiểm tra tài khoản theo Email
        User user = userRepository.findByEmail(emailFormatted)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản liên kết với email này."));

        if (user.getStatus() == UserStatus.INACTIVE) {
            throw new LockedException("Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên.");
        }

        // 2. Tạo mật khẩu mới ngẫu nhiên 8 ký tự
        String tempPassword = generateRandomPassword(8);

        // 3. Cập nhật mật khẩu mới, reset trạng thái khóa và đặt cờ bắt buộc đổi mật khẩu
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setMustChangePassword(true);
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        // 4. Trích xuất thông tin người dùng ra biến local trước khi đẩy vào thread chạy ngầm
        String toEmail = user.getEmail();
        String username = user.getUsername();
        String fullName = user.getFullName();

        // 5. Gửi email BẤT ĐỒNG BỘ (Async) để phản hồi API ngay lập tức cho Frontend
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                sendPasswordResetEmail(toEmail, username, fullName, tempPassword);
            } catch (Exception e) {
                System.err.println("Lỗi khi gửi mail khôi phục mật khẩu ngầm: " + e.getMessage());
            }
        });
    }

    private void sendPasswordResetEmail(String toEmail, String username, String fullName, String tempPassword) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            // Đặt email gửi và Tên thương hiệu hiển thị
            helper.setFrom("1250080145@sv.hcmunre.edu.vn", "TáoCare");
            helper.setTo(toEmail);
            helper.setSubject("[TáoCare] Cấp lại mật khẩu tài khoản");

            String body = "Xin chào " + fullName + ",\n\n"
                    + "Hệ thống TáoCare đã nhận được yêu cầu khôi phục mật khẩu cho tài khoản ( Tên đăng nhập:" + username + ").\n\n"
                    + "Mật khẩu tạm thời mới của bạn là: " + tempPassword + "\n\n"
                    + "Vui lòng đăng nhập lại bằng mật khẩu tạm thời này và đổi sang mật khẩu riêng ngay lập tức để bảo mật tài khoản.\n\n"
                    + "Trân trọng,\nĐội ngũ Vận hành TáoCare";

            helper.setText(body);

            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("Lỗi khi gửi mail khôi phục mật khẩu: " + e.getMessage());
        }
    }

    private String generateRandomPassword(int length) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}