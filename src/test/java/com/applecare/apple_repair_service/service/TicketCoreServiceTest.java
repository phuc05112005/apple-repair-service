package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.ApprovalDecisionRequest;
import com.applecare.apple_repair_service.dto.request.InspectionRepairItemRequest;
import com.applecare.apple_repair_service.dto.request.IntakeAppointmentDeviceRequest;
import com.applecare.apple_repair_service.dto.request.RecordInspectionRequest;
import com.applecare.apple_repair_service.dto.request.WalkInIntakeRequest;
import com.applecare.apple_repair_service.entity.Appointment;
import com.applecare.apple_repair_service.entity.AppointmentDevice;
import com.applecare.apple_repair_service.entity.AppointmentServiceItem;
import com.applecare.apple_repair_service.entity.AppointmentSlot;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.entity.ServiceStatusHistory;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.AppointmentStatus;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.exception.InvalidStateTransitionException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AppointmentServiceItemRepository;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.repository.RepairItemRepository;
import com.applecare.apple_repair_service.repository.ServiceStatusHistoryRepository;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;
import jakarta.validation.Validation;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TicketCoreServiceTest {
    final ServiceTicketRepository tickets = mock(ServiceTicketRepository.class);
    final RepairItemRepository repairs = mock(RepairItemRepository.class);
    final AppointmentServiceItemRepository booking = mock(AppointmentServiceItemRepository.class);
    final ServiceStatusHistoryRepository histories = mock(ServiceStatusHistoryRepository.class);
    final AssignmentRepository assignments = mock(AssignmentRepository.class);
    final CustomerIdentity customers = mock(CustomerIdentity.class);
    final DomainAccess access = mock(DomainAccess.class);
    final TicketCodeGenerator codes = mock(TicketCodeGenerator.class);
    final List<ServiceStatusHistory> history = new ArrayList<>();
    final List<RepairItem> items = new ArrayList<>();
    final ServiceStatusService status = new ServiceStatusService(histories, assignments, TestData.CLOCK);
    final BusinessRules rules = new BusinessRules(Validation.buildDefaultValidatorFactory().getValidator());
    final ServiceTicketService service = new ServiceTicketService(tickets, repairs, booking, histories, customers, access, rules, new EntityResponses(), status, codes, new WarrantyPolicy(), TestData.CLOCK, new RetryingWrites(new WriteTransaction()), new PaymentService(repairs, access, rules, TestData.CLOCK));

    @BeforeEach
    void setup() {
        when(histories.save(any())).thenAnswer(i -> {
            ServiceStatusHistory h = i.getArgument(0);
            h.setId((long) history.size() + 1);
            history.add(h);
            return h;
        });
        when(histories.findAllByServiceTicket_IdOrderByChangedAtAsc(any())).thenAnswer(i -> history);
        when(repairs.findAllByServiceTicket_Id(any())).thenAnswer(i -> items);
        when(repairs.save(any())).thenAnswer(i -> {
            RepairItem r = i.getArgument(0);
            if (!items.contains(r)) items.add(r);
            return r;
        });
        when(access.get(User.class, 1L)).thenReturn(TestData.user(1));
        when(assignments.findFirstByServiceTicket_IdAndStatus(any(), any())).thenReturn(Optional.empty());
        when(tickets.saveAndFlush(any())).thenAnswer(i -> {
            ServiceTicket t = i.getArgument(0);
            t.setId(1L);
            return t;
        });
        when(codes.next()).thenReturn("ST-test");
    }

    ServiceTicket ticket(ServiceTicketStatus state) {
        var t = TestData.ticket(state);
        when(access.lock(ServiceTicket.class, 1L)).thenReturn(t);
        return t;
    }

    @Test
    void transitionsCreateHistoryAndRejectInvalid() {
        var t = ticket(ServiceTicketStatus.WAITING_ASSIGNMENT);
        status.initialize(t, TestData.user(1));
        status.changeStatus(t, ServiceTicketStatus.ASSIGNED, TestData.user(1), null);
        service.startInspection(1L, 1L);
        assertEquals(ServiceTicketStatus.INSPECTING, t.getStatus());
        assertEquals(3, history.size());
        assertNull(history.getFirst().getFromStatus());
        assertEquals(ServiceTicketStatus.ASSIGNED, history.getLast().getFromStatus());
        assertThrows(InvalidStateTransitionException.class, () -> service.waitForPart(1L, 1L, null));
        assertEquals(3, history.size());
    }

    @Test
    void inspectionWithoutApprovalStartsRepair() {
        inspect(false);
        assertEquals(ServiceTicketStatus.REPAIRING, history.getLast().getToStatus());
        assertEquals(ApprovalStatus.APPROVED, items.getFirst().getApprovalStatus());
    }

    @Test
    void inspectionWithApprovalWaits() {
        inspect(true);
        assertEquals(ServiceTicketStatus.WAITING_APPROVAL, history.getLast().getToStatus());
        assertEquals(ApprovalStatus.PENDING, items.getFirst().getApprovalStatus());
    }

    @Test
    void revisedQuoteForSameCatalogRetainsHistoricalSnapshotWithoutDoubleCharging() {
        var t = ticket(ServiceTicketStatus.INSPECTING);
        var old = TestData.item(2, t, ApprovalStatus.APPROVED);
        old.setItemNameSnapshot("Original quote");
        old.setBasePrice(new BigDecimal("100.00"));
        old.setFinalPrice(new BigDecimal("90.00"));
        items.add(old);
        var catalog = old.getServiceCatalogItem();
        when(access.get(ServiceCatalogItem.class, catalog.getId())).thenReturn(catalog);
        service.recordInspection(1L, new RecordInspectionRequest("Revised quote", 1L, true,
                List.of(new InspectionRepairItemRequest(catalog.getId(), new BigDecimal("200.00"), new BigDecimal("180.00"), null))));

        assertEquals(2, items.size());
        assertEquals(ApprovalStatus.REJECTED, old.getApprovalStatus());
        assertEquals("Original quote", old.getItemNameSnapshot());
        assertEquals(new BigDecimal("90.00"), old.getFinalPrice());
        assertEquals(1L, old.getApprovalRecordedBy().getId());
        assertNotNull(old.getApprovalDecisionAt());
        var proposed = items.getLast();
        assertNotSame(old, proposed);
        assertEquals(ApprovalStatus.PENDING, proposed.getApprovalStatus());
        assertEquals(new BigDecimal("180.00"), proposed.getFinalPrice());
        proposed.setId(3L);
        when(access.get(RepairItem.class, 3L)).thenReturn(proposed);
        when(access.lock(RepairItem.class, 3L)).thenReturn(proposed);
        when(access.get(ServiceTicket.class, 1L)).thenReturn(t);
        new RepairItemService(repairs, access, rules, status, new EntityResponses(), TestData.CLOCK)
                .recordApprovalDecision(3L, new ApprovalDecisionRequest(ApprovalStatus.APPROVED, 1L, "Accepted"));
        var total = new PaymentService(repairs, access, rules, TestData.CLOCK).calculateTicketTotal(1L);
        assertEquals(new BigDecimal("180.00"), total);
        verify(repairs, never()).delete(any());
    }

    @Test
    void unchangedInspectionReusesExistingItem() {
        var t = ticket(ServiceTicketStatus.INSPECTING);
        var old = TestData.item(2, t, ApprovalStatus.APPROVED);
        items.add(old);
        var catalog = old.getServiceCatalogItem();
        old.setItemNameSnapshot(catalog.getName());
        when(access.get(ServiceCatalogItem.class, catalog.getId())).thenReturn(catalog);
        service.recordInspection(1L, new RecordInspectionRequest("Confirmed plan", 1L, false,
                List.of(new InspectionRepairItemRequest(catalog.getId(), old.getBasePrice(), old.getFinalPrice(), null))));
        assertEquals(1, items.size());
        assertSame(old, items.getFirst());
        assertEquals(ApprovalStatus.APPROVED, old.getApprovalStatus());
        assertEquals(ServiceTicketStatus.REPAIRING, t.getStatus());
    }

    void inspect(boolean required) {
        ticket(ServiceTicketStatus.INSPECTING);
        when(access.get(ServiceCatalogItem.class, 2L)).thenReturn(TestData.catalog(2));
        service.recordInspection(1L, new RecordInspectionRequest("Inspected", 1L, required, List.of(new InspectionRepairItemRequest(2L, BigDecimal.TEN, BigDecimal.TEN, null))));
    }

    @Test
    void approvedDecisionResumesAfterAllResolved() {
        approval(ApprovalStatus.APPROVED);
        assertEquals(ServiceTicketStatus.REPAIRING, history.getLast().getToStatus());
    }

    @Test
    void allRejectedSkipsRepair() {
        approval(ApprovalStatus.REJECTED);
        assertEquals(ServiceTicketStatus.WAITING_HANDOVER, history.getLast().getToStatus());
    }

    void approval(ApprovalStatus decision) {
        var t = ticket(ServiceTicketStatus.WAITING_APPROVAL);
        var item = TestData.item(2, t, ApprovalStatus.PENDING);
        items.add(item);
        when(access.get(RepairItem.class, 2L)).thenReturn(item);
        when(access.lock(RepairItem.class, 2L)).thenReturn(item);
        new RepairItemService(repairs, access, rules, status, new EntityResponses(), TestData.CLOCK).recordApprovalDecision(2L, new ApprovalDecisionRequest(decision, 1L, "ok"));
    }

    @Test
    void duplicateIntakeRejected() {
        var a = new Appointment();
        a.setId(1L);
        a.setStatus(AppointmentStatus.ARRIVED);
        var d = new AppointmentDevice();
        d.setId(2L);
        d.setAppointment(a);
        when(access.get(AppointmentDevice.class, 2L)).thenReturn(d);
        when(access.lock(Appointment.class, 1L)).thenReturn(a);
        when(tickets.findByAppointmentDevice_Id(2L)).thenReturn(Optional.of(new ServiceTicket()));
        assertThrows(ConflictException.class, () -> service.intakeAppointmentDevice(new IntakeAppointmentDeviceRequest(2L, null, null, "Good", 1L)));
        verifyNoInteractions(customers);
    }

    @Test
    void intakeCopiesBookingAndInitialHistory() {
        var physical = TestData.ticket(ServiceTicketStatus.WAITING_ASSIGNMENT).getCustomerDevice();
        var a = new Appointment();
        a.setId(1L);
        a.setStatus(AppointmentStatus.ARRIVED);
        a.setCustomer(physical.getCustomer());
        a.setDiscountPercent(new BigDecimal("10"));
        var slot = new AppointmentSlot();
        slot.setBranch(TestData.branch(1));
        a.setAppointmentSlot(slot);
        var d = new AppointmentDevice();
        d.setId(2L);
        d.setAppointment(a);
        d.setDeviceModel(physical.getDeviceModel());
        when(access.get(AppointmentDevice.class, 2L)).thenReturn(d);
        when(access.lock(Appointment.class, 1L)).thenReturn(a);
        when(access.get(Branch.class, 1L)).thenReturn(slot.getBranch());
        when(customers.resolveDevice(eq(1L), any())).thenReturn(physical);
        var bi = new AppointmentServiceItem();
        bi.setServiceCatalogItem(TestData.catalog(3));
        bi.setServiceNameSnapshot("Snapshot");
        bi.setBasePriceSnapshot(BigDecimal.TEN);
        bi.setFinalPriceSnapshot(BigDecimal.ONE);
        when(booking.findAllByAppointmentDevice_Id(2L)).thenReturn(List.of(bi));
        var result = service.intakeAppointmentDevice(new IntakeAppointmentDeviceRequest(2L, null, null, "Good", 1L));
        assertEquals(2L, result.ticket().appointmentDeviceId());
        assertEquals(new BigDecimal("10"), result.ticket().discountPercent());
        assertEquals("Snapshot", items.getFirst().getItemNameSnapshot());
        assertEquals(ApprovalStatus.APPROVED, items.getFirst().getApprovalStatus());
        assertEquals(1, history.size());
    }

    @Test
    void walkInHasZeroDiscountAndInitialHistory() {
        var physical = TestData.ticket(ServiceTicketStatus.WAITING_ASSIGNMENT).getCustomerDevice();
        when(access.get(Branch.class, 1L)).thenReturn(TestData.branch(1));
        when(access.get(DeviceModel.class, 1L)).thenReturn(physical.getDeviceModel());
        when(customers.resolve("An", "0901")).thenReturn(physical.getCustomer());
        when(customers.resolveDevice(eq(1L), any())).thenReturn(physical);
        var result = service.createWalkInTicket(new WalkInIntakeRequest("An", "0901", 1L, 1L, null, null, "Good", List.of()), 1L);
        assertEquals(BigDecimal.ZERO, result.ticket().discountPercent());
        assertNull(result.ticket().appointmentDeviceId());
        assertEquals(1, history.size());
    }

    @Test
    void durationExcludesWaitingAndTracksOpenInterval() {
        var duration = new RepairDurationService(histories, access, TestData.CLOCK);
        var records = new ArrayList<ServiceStatusHistory>();
        ServiceTicketStatus previous = null;
        int[] minutes = {0, 0, 0, 0, 60, 120, 180, 210};
        var states = new ServiceTicketStatus[]{ServiceTicketStatus.WAITING_ASSIGNMENT, ServiceTicketStatus.ASSIGNED, ServiceTicketStatus.INSPECTING, ServiceTicketStatus.WAITING_APPROVAL, ServiceTicketStatus.REPAIRING, ServiceTicketStatus.WAITING_PART, ServiceTicketStatus.REPAIRING, ServiceTicketStatus.WAITING_HANDOVER};
        var start = LocalDateTime.of(2026, 9, 11, 6, 0);
        for (int i = 0; i < states.length; i++) {
            var h = new ServiceStatusHistory();
            h.setId((long) i);
            h.setFromStatus(previous);
            h.setToStatus(states[i]);
            h.setChangedAt(start.plusMinutes(minutes[i]));
            records.add(h);
            previous = states[i];
        }
        assertEquals(90, duration.calculate(records, null));
        records.removeLast();
        assertEquals(60, duration.calculate(records, null));
        assertEquals(120, duration.calculate(records, start.plusMinutes(240)));
        records.get(1).setFromStatus(ServiceTicketStatus.ASSIGNED);
        assertThrows(BusinessRuleViolationException.class, () -> duration.calculate(records, null));
    }
}
