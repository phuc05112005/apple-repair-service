package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateServiceFeedbackRequest;
import com.applecare.apple_repair_service.dto.request.HandoverRequest;
import com.applecare.apple_repair_service.dto.request.RecordPaymentRequest;
import com.applecare.apple_repair_service.dto.request.WarrantyDecisionRequest;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceFeedback;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.PaymentMethod;
import com.applecare.apple_repair_service.enums.PaymentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.enums.WarrantyDecision;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AppointmentServiceItemRepository;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.repository.RepairItemRepository;
import com.applecare.apple_repair_service.repository.ServiceFeedbackRepository;
import com.applecare.apple_repair_service.repository.ServiceStatusHistoryRepository;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;
import jakarta.validation.Validation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ClosureServiceTest {
    final DomainAccess access = mock(DomainAccess.class);
    final RepairItemRepository repairs = mock(RepairItemRepository.class);
    final BusinessRules rules = new BusinessRules(Validation.buildDefaultValidatorFactory().getValidator());
    final PaymentService payments = new PaymentService(repairs, access, rules, TestData.CLOCK);
    final ServiceTicket ticket = TestData.ticket(ServiceTicketStatus.WAITING_HANDOVER);

    @BeforeEach
    void setup() {
        when(access.get(ServiceTicket.class, 1L)).thenReturn(ticket);
        when(access.lock(ServiceTicket.class, 1L)).thenReturn(ticket);
    }

    @Test
    void totalOnlyApprovedFinalPricesNotParts() {
        var approved = TestData.item(1, ticket, ApprovalStatus.APPROVED);
        approved.setFinalPrice(new BigDecimal("100"));
        var rejected = TestData.item(2, ticket, ApprovalStatus.REJECTED);
        rejected.setFinalPrice(new BigDecimal("500"));
        var pending = TestData.item(3, ticket, ApprovalStatus.PENDING);
        var unknown = TestData.item(4, ticket, ApprovalStatus.APPROVED);
        unknown.setFinalPrice(null);
        when(repairs.findAllByServiceTicket_Id(1L)).thenReturn(List.of(approved, rejected, pending));
        assertEquals(new BigDecimal("100.00"), payments.calculateTicketTotal(1L));
    }

    @Test
    void unknownApprovedPriceBlocksPaymentZeroSettlementAndHandover() {
        var unknown = TestData.item(4, ticket, ApprovalStatus.APPROVED);
        unknown.setFinalPrice(null);
        when(repairs.findAllByServiceTicket_Id(1L)).thenReturn(List.of(unknown));
        var error = assertThrows(BusinessRuleViolationException.class, () -> payments.recordPayment(1L, new RecordPaymentRequest(PaymentMethod.CASH)));
        assertTrue(error.getMessage().contains("chưa xác định giá"));
        assertThrows(BusinessRuleViolationException.class, () -> payments.settleZeroAmountTicket(1L));
        assertThrows(BusinessRuleViolationException.class, () -> ticketService().handover(1L, new HandoverRequest(1L)));
        assertEquals(PaymentStatus.PENDING, ticket.getPaymentStatus());
        assertNull(unknown.getFinalPrice());
    }

    @Test
    void explicitFreeAndApprovedWarrantyPricesSettleNormally() {
        var free = TestData.item(1, ticket, ApprovalStatus.APPROVED);
        free.setFinalPrice(BigDecimal.ZERO);
        var warranty = TestData.item(2, ticket, ApprovalStatus.APPROVED);
        warranty.getServiceCatalogItem().getServiceType().setCode(ServiceTypeCode.WARRANTY);
        warranty.setWarrantySourceItem(source());
        warranty.setWarrantyDecision(WarrantyDecision.APPROVED);
        warranty.setFinalPrice(BigDecimal.ZERO);
        when(repairs.findAllByServiceTicket_Id(1L)).thenReturn(List.of(free, warranty));
        payments.settleZeroAmountTicket(1L);
        assertEquals(PaymentStatus.PAID, ticket.getPaymentStatus());
        assertEquals(new BigDecimal("0.00"), payments.calculateTicketTotal(1L));
    }

    @Test
    void duplicatePaymentRejected() {
        when(repairs.findAllByServiceTicket_Id(1L)).thenReturn(List.of(TestData.item(1, ticket, ApprovalStatus.APPROVED)));
        payments.recordPayment(1L, new RecordPaymentRequest(PaymentMethod.CASH));
        assertEquals(PaymentStatus.PAID, ticket.getPaymentStatus());
        assertThrows(ConflictException.class, () -> payments.recordPayment(1L, new RecordPaymentRequest(PaymentMethod.CARD)));
    }

    @Test
    void zeroSettlementHasNoFakeMethod() {
        payments.settleZeroAmountTicket(1L);
        assertEquals(PaymentStatus.PAID, ticket.getPaymentStatus());
        assertNull(ticket.getPaymentMethod());
        assertNotNull(ticket.getPaidAt());
    }

    @Test
    void positiveUnpaidCannotHandover() {
        var service = ticketService();
        when(repairs.findAllByServiceTicket_Id(1L)).thenReturn(List.of(TestData.item(1, ticket, ApprovalStatus.APPROVED)));
        assertThrows(BusinessRuleViolationException.class, () -> service.handover(1L, new HandoverRequest(1L)));
    }

    @Test
    void paidCanHandover() {
        var service = ticketService();
        when(repairs.findAllByServiceTicket_Id(1L)).thenReturn(List.of(TestData.item(1, ticket, ApprovalStatus.APPROVED)));
        payments.recordPayment(1L, new RecordPaymentRequest(PaymentMethod.CASH));
        service.handover(1L, new HandoverRequest(1L));
        assertEquals(ServiceTicketStatus.HANDED_OVER, ticket.getStatus());
    }

    @Test
    void zeroHandoverSettlesAutomatically() {
        ticketService().handover(1L, new HandoverRequest(1L));
        assertEquals(ServiceTicketStatus.HANDED_OVER, ticket.getStatus());
        assertEquals(PaymentStatus.PAID, ticket.getPaymentStatus());
        assertNull(ticket.getPaymentMethod());
    }

    ServiceTicketService ticketService() {
        var histories = mock(ServiceStatusHistoryRepository.class);
        var assignments = mock(AssignmentRepository.class);
        when(access.get(User.class, 1L)).thenReturn(TestData.user(1));
        return new ServiceTicketService(mock(ServiceTicketRepository.class), repairs, mock(AppointmentServiceItemRepository.class), histories, mock(CustomerIdentity.class), access, rules, new EntityResponses(), new ServiceStatusService(histories, assignments, TestData.CLOCK, mock(ServiceTimingService.class)), mock(TicketCodeGenerator.class), new WarrantyPolicy(), TestData.CLOCK, new RetryingWrites(new WriteTransaction()), payments, mock(com.applecare.apple_repair_service.repository.PartUsageRepository.class));
    }

    RepairItem source() {
        var t = TestData.ticket(ServiceTicketStatus.HANDED_OVER);
        var item = TestData.item(9, t, ApprovalStatus.APPROVED);
        item.setWarrantyStartDate(LocalDate.now(TestData.CLOCK));
        item.setWarrantyEndDate(LocalDate.now(TestData.CLOCK).plusDays(30));
        when(access.get(RepairItem.class, 9L)).thenReturn(item);
        return item;
    }

    WarrantyService warranty() {
        return new WarrantyService(access, rules, new WarrantyPolicy(), new EntityResponses(), TestData.CLOCK);
    }

    @Test
    void warrantyInclusiveDatesAndExpired() {
        var i = source();
        assertTrue(warranty().checkEligibility(9L, i.getWarrantyStartDate()).eligible());
        assertTrue(warranty().checkEligibility(9L, i.getWarrantyEndDate()).eligible());
        assertFalse(warranty().checkEligibility(9L, i.getWarrantyEndDate().plusDays(1)).eligible());
    }

    @Test
    void approvedWarrantyZerosPrice() {
        decide(WarrantyDecision.APPROVED);
        assertEquals(new BigDecimal("0.00"), repairsItem.getFinalPrice());
    }

    @Test
    void rejectedWarrantyKeepsPrice() {
        decide(WarrantyDecision.REJECTED);
        assertEquals(BigDecimal.TEN, repairsItem.getFinalPrice());
    }

    RepairItem repairsItem;

    void decide(WarrantyDecision decision) {
        var source = source();
        ticket.setStatus(ServiceTicketStatus.REPAIRING);
        repairsItem = TestData.item(2, ticket, ApprovalStatus.APPROVED);
        repairsItem.setWarrantySourceItem(source);
        repairsItem.getServiceCatalogItem().getServiceType().setCode(ServiceTypeCode.WARRANTY);
        when(access.get(RepairItem.class, 2L)).thenReturn(repairsItem);
        when(access.lock(RepairItem.class, 2L)).thenReturn(repairsItem);
        warranty().recordWarrantyDecision(2L, new WarrantyDecisionRequest(decision, "Reason"));
    }

    @Test
    void feedbackRequiresHandoverAndIsUnique() {
        var repo = mock(ServiceFeedbackRepository.class);
        var service = new FeedbackService(repo, access, rules, new EntityResponses());
        var r = new CreateServiceFeedbackRequest(1L, true, " Great ");
        assertThrows(BusinessRuleViolationException.class, () -> service.createFeedback(r));
        ticket.setStatus(ServiceTicketStatus.HANDED_OVER);
        when(repo.saveAndFlush(any())).thenAnswer(i -> {
            ServiceFeedback f = i.getArgument(0);
            when(repo.findByServiceTicket_Id(1L)).thenReturn(Optional.of(f));
            return f;
        });
        assertEquals("Great", service.createFeedback(r).comment());
        assertThrows(ConflictException.class, () -> service.createFeedback(r));
    }
}
