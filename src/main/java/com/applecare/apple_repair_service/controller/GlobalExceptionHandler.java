package com.applecare.apple_repair_service.controller;
import com.applecare.apple_repair_service.dto.error.*;
import com.applecare.apple_repair_service.exception.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.method.MethodValidationException;
import org.springframework.web.bind.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.*;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import java.time.Clock;
import java.util.*;
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {
    private static final Logger LOG=LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final Clock clock;
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> notFound(ResourceNotFoundException ex,HttpServletRequest r) {
        return error(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND",ex.getMessage(),r,List.of());
    }
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiErrorResponse> business(BusinessException ex,HttpServletRequest r) {
        HttpStatus status=HttpStatus.BAD_REQUEST;String code="BUSINESS_RULE_VIOLATION";
        if(ex instanceof DuplicateResourceException){status=HttpStatus.CONFLICT;code="DUPLICATE_RESOURCE";}
        else if(ex instanceof InvalidStateTransitionException){status=HttpStatus.CONFLICT;code="INVALID_STATE_TRANSITION";}
        else if(ex instanceof InsufficientStockException){status=HttpStatus.CONFLICT;code="INSUFFICIENT_STOCK";}
        else if(ex instanceof ConflictException){status=HttpStatus.CONFLICT;code="CONFLICT";}
        return error(status,code,ex.getMessage(),r,List.of());
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> invalid(MethodArgumentNotValidException ex,HttpServletRequest r) {
        var fields=ex.getBindingResult().getFieldErrors().stream().map(e->new FieldErrorResponse(e.getField(),e.getDefaultMessage())).toList();
        return error(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Request validation failed",r,fields);
    }
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> invalidConstraint(ConstraintViolationException ex,HttpServletRequest r) {
        var fields=ex.getConstraintViolations().stream().map(v->new FieldErrorResponse(v.getPropertyPath().toString(),v.getMessage())).toList();
        return error(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Request validation failed",r,fields);
    }
    @ExceptionHandler({HandlerMethodValidationException.class,MethodValidationException.class})
    public ResponseEntity<ApiErrorResponse> invalidMethod(Exception ex,HttpServletRequest r) {
        return error(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Request parameters are invalid",r,List.of());
    }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> malformed(HttpMessageNotReadableException ex,HttpServletRequest r) {
        return error(HttpStatus.BAD_REQUEST,"MALFORMED_JSON","Malformed JSON or unsupported field value",r,List.of());
    }
    @ExceptionHandler({MissingServletRequestParameterException.class,MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiErrorResponse> invalidParameter(Exception ex,HttpServletRequest r) {
        return error(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Thông tin gửi lên chưa đầy đủ hoặc chưa đúng định dạng. Vui lòng kiểm tra và thử lại.",r,List.of());
    }
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiErrorResponse> authentication(AuthenticationException ex,HttpServletRequest r) {
        return error(HttpStatus.UNAUTHORIZED,"AUTHENTICATION_FAILED","Invalid credentials or inactive account",r,List.of());
    }
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> denied(AccessDeniedException ex,HttpServletRequest r) {
        return error(HttpStatus.FORBIDDEN,"ACCESS_DENIED","Access denied",r,List.of());
    }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> integrity(DataIntegrityViolationException ex,HttpServletRequest r) {
        return error(HttpStatus.CONFLICT,"CONFLICT","Resource conflicts with existing data",r,List.of());
    }
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiErrorResponse> noRoute(NoResourceFoundException ex,HttpServletRequest r) {
        return error(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Resource not found",r,List.of());
    }
    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> wrongMethod(Exception ex,HttpServletRequest r) {
        return error(HttpStatus.METHOD_NOT_ALLOWED,"METHOD_NOT_ALLOWED","HTTP method not allowed",r,List.of());
    }
    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> wrongMedia(Exception ex,HttpServletRequest r) {
        return error(HttpStatus.UNSUPPORTED_MEDIA_TYPE,"UNSUPPORTED_MEDIA_TYPE","Unsupported content type",r,List.of());
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> unexpected(Exception ex,HttpServletRequest r) {
        LOG.error("Unhandled server error for {}",r.getRequestURI(),ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR,"INTERNAL_ERROR","An unexpected server error occurred",r,List.of());
    }
    private ResponseEntity<ApiErrorResponse> error(HttpStatus status,String code,String message,HttpServletRequest r,List<FieldErrorResponse> fields) {
        return ResponseEntity.status(status).body(new ApiErrorResponse(clock.instant(),status.value(),status.getReasonPhrase(),code,message,r.getRequestURI(),fields));
    }
}
