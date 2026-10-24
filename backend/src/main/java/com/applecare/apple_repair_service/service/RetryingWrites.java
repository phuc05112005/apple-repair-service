package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.exception.ConflictException;

import java.util.function.Supplier;
import java.util.Locale;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
@RequiredArgsConstructor
public class RetryingWrites {
    private static final Logger LOG = LoggerFactory.getLogger(RetryingWrites.class);
    private static final int MAX_ATTEMPTS = 3;
    private final WriteTransaction transaction;

    public <T> T execute(Supplier<T> action) {
        boolean joined = TransactionSynchronizationManager.isActualTransactionActive();
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return transaction.execute(action);
            } catch (DataIntegrityViolationException ex) {
                String constraint = ex.getMostSpecificCause().getMessage();
                constraint = constraint == null ? "" : constraint.toLowerCase(Locale.ROOT);
                boolean retryable = constraint.contains("uk_customers_phone")
                        || constraint.contains("uk_customer_devices_serial_number")
                        || constraint.contains("uk_service_tickets_ticket_code");
                if (!retryable || joined || attempt == MAX_ATTEMPTS) {
                    LOG.warn("Write conflict is not retryable (joinedTransaction={}, attempt={}, cause={})",
                            joined, attempt, constraint, ex);
                }
                if (joined || !retryable || attempt == MAX_ATTEMPTS)
                    throw new ConflictException("Dữ liệu đã thay đổi hoặc yêu cầu bị gửi lặp. Tải lại lịch/phiếu rồi thử lại.", ex);
            }
        }
        throw new IllegalStateException("Unreachable retry state");
    }
}
