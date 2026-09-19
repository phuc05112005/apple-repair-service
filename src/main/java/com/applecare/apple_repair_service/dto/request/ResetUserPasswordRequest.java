package com.applecare.apple_repair_service.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetUserPasswordRequest(
        @NotBlank(message = "Cần nhập mật khẩu mới")
        @Size(min = 10, max = 72, message = "Mật khẩu phải từ 10 đến 72 ký tự") String password
) {
    @Override public String toString() { return "ResetUserPasswordRequest[password redacted]"; }
}
