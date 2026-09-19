package com.applecare.apple_repair_service.dto.request;
import com.applecare.apple_repair_service.enums.UserRole;
import com.applecare.apple_repair_service.enums.UserStatus;
import jakarta.validation.constraints.*;
public record CreateUserRequest(@NotBlank(message="Cần nhập tên đăng nhập") @Size(min=3,max=100,message="Tên đăng nhập phải từ 3 đến 100 ký tự") String username,
        @NotBlank(message="Cần nhập mật khẩu") @Size(min=10,max=72,message="Mật khẩu phải từ 10 đến 72 ký tự") String password,
        @NotBlank(message="Cần nhập họ tên") @Size(max=255,message="Họ tên quá dài") String fullName,
        @Size(max=255,message="Số điện thoại quá dài") String phone, @NotNull(message="Cần chọn vai trò") UserRole role, UserStatus status) {
    public CreateUserRequest(String username, String password, String fullName, String phone, UserRole role) {
        this(username, password, fullName, phone, role, UserStatus.ACTIVE);
    }
    @Override public String toString() { return "CreateUserRequest[credentials redacted]"; }
}
