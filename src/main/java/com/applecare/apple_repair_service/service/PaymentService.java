package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.RecordPaymentRequest;
import com.applecare.apple_repair_service.dto.response.TicketPaymentSummaryResponse;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.PaymentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.repository.RepairItemRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDateTime;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PaymentService {
    private final RepairItemRepository items;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final Clock clock;

    public BigDecimal calculateTicketTotal(Long id) {
        access.get(ServiceTicket.class, id);
        var approved = items.findAllByServiceTicket_Id(id).stream()
                .filter(i -> i.getApprovalStatus() == ApprovalStatus.APPROVED).toList();
        BusinessRules.require(approved.stream().allMatch(item -> item.getFinalPrice() != null),
                "Phiếu còn hạng mục chưa xác định giá. Vui lòng cập nhật giá trước khi thanh toán.");
        // Explicit zero prices, including approved warranty decisions, remain valid.
        return approved.stream().map(RepairItem::getFinalPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2, RoundingMode.HALF_UP);
    }

    public TicketPaymentSummaryResponse getSummary(Long id) {
        var t = access.get(ServiceTicket.class, id);
        return summary(t);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public TicketPaymentSummaryResponse recordPayment(Long id, RecordPaymentRequest r) {
        rules.validate(r);
        var t = access.lock(ServiceTicket.class, id);
        payable(t);
        BusinessRules.require(calculateTicketTotal(id).signum() > 0, "Use zero-amount settlement for a zero total");
        t.setPaymentStatus(PaymentStatus.PAID);
        t.setPaymentMethod(r.paymentMethod());
        t.setPaidAt(LocalDateTime.now(clock));
        return summary(t);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public TicketPaymentSummaryResponse settleZeroAmountTicket(Long id) {
        var t = access.lock(ServiceTicket.class, id);
        payable(t);
        BusinessRules.require(calculateTicketTotal(id).signum() == 0, "Ticket total is not zero");
        settleZero(t);
        return summary(t);
    }

    void settleZero(ServiceTicket t) {
        t.setPaymentStatus(PaymentStatus.PAID);
        t.setPaymentMethod(null);
        t.setPaidAt(LocalDateTime.now(clock));
    }

    private void payable(ServiceTicket t) {
        BusinessRules.require(t.getStatus() == ServiceTicketStatus.WAITING_HANDOVER, "Ticket must be WAITING_HANDOVER");
        if (t.getPaymentStatus() == PaymentStatus.PAID) throw new ConflictException("Payment already recorded");
        BusinessRules.require(calculateTicketTotal(t.getId()).signum() >= 0, "Negative ticket total");
    }

    private TicketPaymentSummaryResponse summary(ServiceTicket t) {
        return new TicketPaymentSummaryResponse(t.getId(), calculateTicketTotal(t.getId()), t.getPaymentStatus(), t.getPaymentMethod(), t.getPaidAt());
    }
}
