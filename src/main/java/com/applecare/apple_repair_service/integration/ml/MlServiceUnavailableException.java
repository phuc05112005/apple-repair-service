package com.applecare.apple_repair_service.integration.ml;

public class MlServiceUnavailableException extends RuntimeException {
    private final String reasonCode;

    public MlServiceUnavailableException(String reasonCode, String message) {
        super(message);
        this.reasonCode = reasonCode;
    }

    public MlServiceUnavailableException(String reasonCode, String message, Throwable cause) {
        super(message, cause);
        this.reasonCode = reasonCode;
    }

    public String reasonCode() {
        return reasonCode;
    }
}
