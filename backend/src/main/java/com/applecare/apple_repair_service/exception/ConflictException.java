package com.applecare.apple_repair_service.exception;

public class ConflictException extends BusinessException {
    public ConflictException(String message) {
        super(message);
    }

    public ConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}
