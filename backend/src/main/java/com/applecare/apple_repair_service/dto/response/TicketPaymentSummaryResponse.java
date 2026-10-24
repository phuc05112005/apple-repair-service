package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.PaymentMethod;
import com.applecare.apple_repair_service.enums.PaymentStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TicketPaymentSummaryResponse(Long serviceTicketId, BigDecimal totalAmount, PaymentStatus paymentStatus,
                                           PaymentMethod paymentMethod, LocalDateTime paidAt) {
}
