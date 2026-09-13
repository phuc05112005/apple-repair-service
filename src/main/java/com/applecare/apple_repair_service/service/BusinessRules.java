package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import jakarta.validation.Validator;

import java.math.BigDecimal;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class BusinessRules {
    private final Validator validator;

    public <T> T validate(T request) {
        require(request != null, "Request is required");
        var violations = validator.validate(request);
        if (!violations.isEmpty()) throw new BusinessRuleViolationException(violations.stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage()).sorted().reduce((a, b) -> a + "; " + b).orElseThrow());
        return request;
    }

    public static void require(boolean condition, String message) {
        if (!condition) throw new BusinessRuleViolationException(message);
    }

    public static String text(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public static String required(String value, String label) {
        String result = text(value);
        require(result != null, label + " is required");
        return result;
    }

    public static void money(BigDecimal value) {
        require(value == null || value.signum() >= 0, "Price cannot be negative");
    }
}
