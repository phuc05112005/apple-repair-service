package com.applecare.apple_repair_service.service;

import java.util.function.Supplier;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Separate proxy ensures a failed attempt rolls back before its caller retries.
 */
@Component
public class WriteTransaction {
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public <T> T execute(Supplier<T> action) {
        return action.get();
    }
}
