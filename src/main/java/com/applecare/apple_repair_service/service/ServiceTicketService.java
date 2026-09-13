package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CustomerDeviceInfoRequest;
import com.applecare.apple_repair_service.dto.request.HandoverRequest;
import com.applecare.apple_repair_service.dto.request.IntakeAppointmentDeviceRequest;
import com.applecare.apple_repair_service.dto.request.RecordInspectionRequest;
import com.applecare.apple_repair_service.dto.request.WalkInIntakeRequest;
import com.applecare.apple_repair_service.dto.response.ServiceTicketDetailResponse;
import com.applecare.apple_repair_service.dto.response.ServiceTicketSummaryResponse;
import com.applecare.apple_repair_service.entity.Appointment;
import com.applecare.apple_repair_service.entity.AppointmentDevice;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.CustomerDevice;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.AppointmentStatus;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.PaymentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.WarrantyDecision;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AppointmentServiceItemRepository;
import com.applecare.apple_repair_service.repository.RepairItemRepository;
import com.applecare.apple_repair_service.repository.ServiceStatusHistoryRepository;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ServiceTicketService {
    private final ServiceTicketRepository tickets;
    private final RepairItemRepository repairItems;
    private final AppointmentServiceItemRepository bookingItems;
    private final ServiceStatusHistoryRepository histories;
    private final CustomerIdentity customers;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;
    private final ServiceStatusService statuses;
    private final TicketCodeGenerator codes;
    private final WarrantyPolicy warranty;
    private final Clock clock;
    private final RetryingWrites writes;
    private final PaymentService payments;

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTicketDetailResponse handover(Long id, HandoverRequest r) {
        rules.validate(r);
        var t = access.lock(ServiceTicket.class, id);
        BusinessRules.require(t.getStatus() == ServiceTicketStatus.WAITING_HANDOVER, "Ticket must be WAITING_HANDOVER");
        var total = payments.calculateTicketTotal(id);
        BusinessRules.require(total.signum() >= 0, "Negative ticket total");
        if (total.signum() > 0)
            BusinessRules.require(t.getPaymentStatus() == PaymentStatus.PAID, "Positive total must be paid before handover");
        else if (t.getPaymentStatus() != PaymentStatus.PAID) payments.settleZero(t);
        var actor = access.get(User.class, r.handedOverByUserId());
        t.setHandedOverBy(actor);
        t.setHandedOverAt(LocalDateTime.now(clock));
        statuses.changeStatus(t, ServiceTicketStatus.HANDED_OVER, actor, "Handed over");
        return detail(t);
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.SUPPORTS)
    public ServiceTicketDetailResponse intakeAppointmentDevice(IntakeAppointmentDeviceRequest r) {
        return writes.execute(() -> intakeInTransaction(r));
    }

    private ServiceTicketDetailResponse intakeInTransaction(IntakeAppointmentDeviceRequest r) {
        rules.validate(r);
        var device = access.get(AppointmentDevice.class, r.appointmentDeviceId());
        var appointment = access.lock(Appointment.class, device.getAppointment().getId());
        BusinessRules.require(appointment.getStatus() == AppointmentStatus.ARRIVED, "Appointment must be ARRIVED");
        if (tickets.findByAppointmentDevice_Id(device.getId()).isPresent())
            throw new ConflictException("Device already received");
        var physical = customers.resolveDevice(appointment.getCustomer().getId(), new CustomerDeviceInfoRequest(device.getDeviceModel().getId(), r.serialNumber(), r.storage()));
        var ticket = newTicket(physical, appointment.getAppointmentSlot().getBranch().getId(), r.createdByUserId(), r.receivedCondition());
        ticket.setAppointmentDevice(device);
        ticket.setDiscountPercent(appointment.getDiscountPercent());
        tickets.saveAndFlush(ticket);
        for (var booked : bookingItems.findAllByAppointmentDevice_Id(device.getId())) {
            var item = new RepairItem();
            item.setServiceTicket(ticket);
            item.setServiceCatalogItem(booked.getServiceCatalogItem());
            item.setItemNameSnapshot(booked.getServiceNameSnapshot());
            item.setBasePrice(booked.getBasePriceSnapshot());
            item.setFinalPrice(booked.getFinalPriceSnapshot());
            item.setWarrantySourceItem(booked.getWarrantySourceItem());
            item.setApprovalStatus(ApprovalStatus.APPROVED);
            repairItems.save(item);
        }
        statuses.initialize(ticket, ticket.getCreatedBy());
        return detail(ticket);
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.SUPPORTS)
    public ServiceTicketDetailResponse createWalkInTicket(WalkInIntakeRequest r, Long createdByUserId) {
        return writes.execute(() -> walkInTransaction(r, createdByUserId));
    }

    private ServiceTicketDetailResponse walkInTransaction(WalkInIntakeRequest r, Long createdByUserId) {
        rules.validate(r);
        var branch = access.get(Branch.class, r.branchId());
        BusinessRules.require(branch.getStatus() == ActiveStatus.ACTIVE, "Branch is inactive");
        access.get(User.class, createdByUserId);
        access.get(DeviceModel.class, r.deviceModelId());
        var selected = r.serviceCatalogItemIds() == null ? List.<Long>of() : r.serviceCatalogItemIds();
        BusinessRules.require(new HashSet<>(selected).size() == selected.size(), "Duplicate selected service");
        selected.forEach(id -> catalog(id, r.deviceModelId()));
        var customer = customers.resolve(r.customerFullName(), r.phone());
        var physical = customers.resolveDevice(customer.getId(), new CustomerDeviceInfoRequest(r.deviceModelId(), r.serialNumber(), r.storage()));
        var ticket = newTicket(physical, r.branchId(), createdByUserId, r.receivedCondition());
        tickets.saveAndFlush(ticket);
        for (var id : selected) {
            var c = catalog(id, r.deviceModelId());
            var item = new RepairItem();
            item.setServiceTicket(ticket);
            item.setServiceCatalogItem(c);
            item.setItemNameSnapshot(c.getName());
            item.setBasePrice(c.getConfiguredPrice());
            item.setFinalPrice(c.getConfiguredPrice());
            item.setApprovalStatus(ApprovalStatus.APPROVED);
            repairItems.save(item);
        }
        statuses.initialize(ticket, ticket.getCreatedBy());
        return detail(ticket);
    }

    private ServiceTicket newTicket(CustomerDevice physical, Long branchId, Long userId, String condition) {
        var branch = access.get(Branch.class, branchId);
        BusinessRules.require(branch.getStatus() == ActiveStatus.ACTIVE, "Branch is inactive");
        var ticket = new ServiceTicket();
        ticket.setTicketCode(codes.next());
        ticket.setCustomerDevice(physical);
        ticket.setBranch(branch);
        ticket.setCreatedBy(access.get(User.class, userId));
        ticket.setReceivedCondition(BusinessRules.required(condition, "Received condition"));
        ticket.setReceivedAt(LocalDateTime.now(clock));
        ticket.setDiscountPercent(BigDecimal.ZERO);
        return ticket;
    }

    private ServiceCatalogItem catalog(Long id, Long model) {
        var c = access.get(ServiceCatalogItem.class, id);
        BusinessRules.require(c.getStatus() == ActiveStatus.ACTIVE && c.getDeviceModel().getId().equals(model), "Inactive or incompatible catalog");
        return c;
    }

    public ServiceTicketDetailResponse getById(Long id) {
        return detail(access.get(ServiceTicket.class, id));
    }

    public List<ServiceTicketSummaryResponse> findByPhone(String phone) {
        return tickets.findAllByCustomerDevice_Customer_PhoneOrderByReceivedAtDesc(BusinessRules.required(phone, "Phone")).stream()
                .map(t -> new ServiceTicketSummaryResponse(t.getId(), t.getTicketCode(), t.getCustomerDevice().getId(), t.getBranch().getId(), t.getStatus(), t.getReceivedAt())).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTicketDetailResponse startInspection(Long id, Long userId) {
        return move(id, userId, ServiceTicketStatus.INSPECTING, null);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTicketDetailResponse waitForPart(Long id, Long userId, String note) {
        return move(id, userId, ServiceTicketStatus.WAITING_PART, note);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTicketDetailResponse resumeRepair(Long id, Long userId) {
        return move(id, userId, ServiceTicketStatus.REPAIRING, null);
    }

    private ServiceTicketDetailResponse move(Long id, Long userId, ServiceTicketStatus next, String note) {
        var t = access.lock(ServiceTicket.class, id);
        statuses.changeStatus(t, next, access.get(User.class, userId), note);
        return detail(t);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTicketDetailResponse cancelTicket(Long id, Long userId, String reason) {
        var t = access.lock(ServiceTicket.class, id);
        String note = BusinessRules.required(reason, "Cancellation reason");
        BusinessRules.require(t.getPaymentStatus() != PaymentStatus.PAID, "Paid ticket cannot be cancelled");
        statuses.changeStatus(t, ServiceTicketStatus.CANCELLED, access.get(User.class, userId), note);
        t.setCancelReason(note);
        return detail(t);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTicketDetailResponse recordInspection(Long id, RecordInspectionRequest r) {
        rules.validate(r);
        var t = access.lock(ServiceTicket.class, id);
        BusinessRules.require(t.getStatus() == ServiceTicketStatus.INSPECTING, "Ticket must be INSPECTING");
        var actor = access.get(User.class, r.inspectedByUserId());
        var current = new ArrayList<>(repairItems.findAllByServiceTicket_Id(id));
        var retained = new HashSet<RepairItem>();
        var selected = new HashSet<Long>();
        for (var request : r.items()) {
            BusinessRules.require(selected.add(request.serviceCatalogItemId()), "Duplicate inspected catalog item");
            var c = catalog(request.serviceCatalogItemId(), t.getCustomerDevice().getDeviceModel().getId());
            var item = current.stream()
                    .filter(x -> !r.requiresCustomerApproval()
                            && x.getServiceCatalogItem().getId().equals(c.getId())
                            && Objects.equals(x.getItemNameSnapshot(), c.getName())
                            && sameAmount(x.getBasePrice(), request.basePrice())
                            && sameAmount(x.getFinalPrice(), request.finalPrice())
                            && Objects.equals(x.getWarrantySourceItem() == null ? null : x.getWarrantySourceItem().getId(), request.warrantySourceItemId()))
                    .findFirst().orElseGet(RepairItem::new);
            retained.add(item);
            item.setServiceTicket(t);
            item.setServiceCatalogItem(c);
            item.setItemNameSnapshot(c.getName());
            item.setBasePrice(request.basePrice());
            item.setFinalPrice(request.finalPrice());
            if (request.warrantySourceItemId() != null) {
                var source = access.get(RepairItem.class, request.warrantySourceItemId());
                BusinessRules.require(!Objects.equals(item.getId(), source.getId()), "Warranty cannot reference itself");
                warranty.validateBooking(source, t.getCustomerDevice().getCustomer().getId(), c, LocalDate.now(clock));
                item.setWarrantySourceItem(source);
            } else item.setWarrantySourceItem(null);
            item.setApprovalStatus(r.requiresCustomerApproval() ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED);
            item.setApprovalRecordedBy(null);
            item.setApprovalDecisionAt(null);
            item.setApprovalNote(null);
            repairItems.save(item);
        }
        // Retain previously selected items for traceability, but exclude superseded work from billing.
        for (var old : current)
            if (!retained.contains(old)) {
                old.setApprovalStatus(ApprovalStatus.REJECTED);
                old.setApprovalRecordedBy(actor);
                old.setApprovalDecisionAt(LocalDateTime.now(clock));
                old.setApprovalNote("Superseded by inspection plan");
            }
        t.setInspectionResult(r.inspectionResult().trim());
        t.setInspectedBy(actor);
        statuses.changeStatus(t, r.requiresCustomerApproval() ? ServiceTicketStatus.WAITING_APPROVAL : ServiceTicketStatus.REPAIRING, actor, "Inspection recorded");
        return detail(t);
    }

    private static boolean sameAmount(BigDecimal first, BigDecimal second) {
        return first == null ? second == null : second != null && first.compareTo(second) == 0;
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTicketDetailResponse finishRepair(Long id, Long userId) {
        var t = access.lock(ServiceTicket.class, id);
        BusinessRules.require(t.getStatus() == ServiceTicketStatus.REPAIRING, "Ticket must be REPAIRING");
        var today = LocalDate.now(clock);
        for (var item : repairItems.findAllByServiceTicket_Id(id)) {
            if (item.getApprovalStatus() != ApprovalStatus.APPROVED) continue;
            if (item.getWarrantySourceItem() != null) {
                BusinessRules.require(item.getWarrantyDecision() != null, "Warranty decision is unresolved");
                if (item.getWarrantyDecision() == WarrantyDecision.APPROVED) {
                    item.setWarrantyStartDate(item.getWarrantySourceItem().getWarrantyStartDate());
                    item.setWarrantyEndDate(item.getWarrantySourceItem().getWarrantyEndDate());
                    continue;
                }
            }
            if (item.getServiceCatalogItem().getWarrantyDays() > 0) {
                item.setWarrantyStartDate(today);
                item.setWarrantyEndDate(today.plusDays(item.getServiceCatalogItem().getWarrantyDays()));
            }
        }
        statuses.changeStatus(t, ServiceTicketStatus.WAITING_HANDOVER, access.get(User.class, userId), "Repair finished");
        return detail(t);
    }

    private ServiceTicketDetailResponse detail(ServiceTicket t) {
        return new ServiceTicketDetailResponse(mapper.map(t), repairItems.findAllByServiceTicket_Id(t.getId()).stream().map(mapper::map).toList(),
                histories.findAllByServiceTicket_IdOrderByChangedAtAsc(t.getId()).stream().map(mapper::map).toList());
    }
}
