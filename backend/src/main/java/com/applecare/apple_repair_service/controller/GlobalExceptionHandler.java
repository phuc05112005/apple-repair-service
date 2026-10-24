package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.error.ApiErrorResponse;
import com.applecare.apple_repair_service.dto.error.FieldErrorResponse;
import com.applecare.apple_repair_service.exception.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.method.MethodValidationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Clock;
import java.util.List;

@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final Clock clock;

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> notFound(ResourceNotFoundException ex, HttpServletRequest request) {
        return error(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", ex.getMessage(), request, List.of());
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiErrorResponse> business(BusinessException ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        String code = "BUSINESS_RULE_VIOLATION";
        if (ex instanceof DuplicateResourceException) {
            status = HttpStatus.CONFLICT;
            code = "DUPLICATE_RESOURCE";
        } else if (ex instanceof InvalidStateTransitionException) {
            status = HttpStatus.CONFLICT;
            code = "INVALID_STATE_TRANSITION";
        } else if (ex instanceof InsufficientStockException) {
            status = HttpStatus.CONFLICT;
            code = "INSUFFICIENT_STOCK";
        } else if (ex instanceof AppointmentTooEarlyException) {
            status = HttpStatus.CONFLICT;
            code = "APPOINTMENT_TOO_EARLY";
        } else if (ex instanceof AppointmentExpiredException) {
            status = HttpStatus.CONFLICT;
            code = "APPOINTMENT_EXPIRED";
        } else if (ex instanceof AppointmentSlotConflictException) {
            status = HttpStatus.CONFLICT;
            code = "APPOINTMENT_SLOT_OVERLAP";
        } else if (ex instanceof ConflictException) {
            status = HttpStatus.CONFLICT;
            code = "CONFLICT";
        }
        return error(status, code, ex.getMessage(), request, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> invalid(MethodArgumentNotValidException ex, HttpServletRequest request) {
        var fields = ex.getBindingResult().getFieldErrors().stream()
                .map(field -> new FieldErrorResponse(field.getField(), field.getDefaultMessage()))
                .toList();
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Dữ liệu gửi lên chưa hợp lệ. Vui lòng kiểm tra các trường và thử lại.", request, fields);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> invalidConstraint(ConstraintViolationException ex,
                                                               HttpServletRequest request) {
        var fields = ex.getConstraintViolations().stream()
                .map(violation -> new FieldErrorResponse(
                        violation.getPropertyPath().toString(), violation.getMessage()))
                .toList();
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Dữ liệu gửi lên chưa hợp lệ. Vui lòng kiểm tra các trường và thử lại.", request, fields);
    }

    @ExceptionHandler({HandlerMethodValidationException.class, MethodValidationException.class})
    public ResponseEntity<ApiErrorResponse> invalidMethod(Exception ex, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Tham số yêu cầu chưa hợp lệ. Vui lòng kiểm tra và thử lại.", request, List.of());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> malformed(HttpMessageNotReadableException ex,
                                                       HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "MALFORMED_JSON",
                "Nội dung yêu cầu không đúng định dạng hoặc có giá trị không được hỗ trợ.", request, List.of());
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiErrorResponse> invalidParameter(Exception ex, HttpServletRequest request) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "Thông tin gửi lên chưa đầy đủ hoặc chưa đúng định dạng. Vui lòng kiểm tra và thử lại.",
                request, List.of());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiErrorResponse> authentication(AuthenticationException ex, HttpServletRequest request) {
        return error(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_FAILED",
                "Tên đăng nhập hoặc mật khẩu không đúng, hoặc tài khoản đã ngừng hoạt động.",
                request, List.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> denied(AccessDeniedException ex, HttpServletRequest request) {
        return error(HttpStatus.FORBIDDEN, "ACCESS_DENIED",
                "Bạn không có quyền thực hiện thao tác này.", request, List.of());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> integrity(DataIntegrityViolationException ex,
                                                       HttpServletRequest request) {
        return error(HttpStatus.CONFLICT, "CONFLICT",
                "Dữ liệu đang được sử dụng hoặc xung đột với dữ liệu hiện có.", request, List.of());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiErrorResponse> noRoute(NoResourceFoundException ex, HttpServletRequest request) {
        return error(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND",
                "Không tìm thấy tài nguyên được yêu cầu.", request, List.of());
    }

    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> wrongMethod(Exception ex, HttpServletRequest request) {
        return error(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED",
                "Phương thức yêu cầu không được hỗ trợ cho địa chỉ này.", request, List.of());
    }

    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> wrongMedia(Exception ex, HttpServletRequest request) {
        return error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE",
                "Định dạng nội dung gửi lên không được hỗ trợ.", request, List.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> unexpected(Exception ex, HttpServletRequest request) {
        LOG.error("Unhandled server error for {}", request.getRequestURI(), ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                "Không thể hoàn tất thao tác. Vui lòng thử lại hoặc liên hệ quản trị viên.",
                request, List.of());
    }

    private ResponseEntity<ApiErrorResponse> error(HttpStatus status, String code, String message,
                                                   HttpServletRequest request, List<FieldErrorResponse> fields) {
        return ResponseEntity.status(status).body(new ApiErrorResponse(
                clock.instant(), status.value(), status.getReasonPhrase(), code, message,
                request.getRequestURI(), fields));
    }
}
