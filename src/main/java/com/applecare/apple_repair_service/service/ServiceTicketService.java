package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CustomerDeviceInfoRequest;
import com.applecare.apple_repair_service.dto.request.HandoverRequest;
import com.applecare.apple_repair_service.dto.request.IntakeAppointmentDeviceRequest;
import com.applecare.apple_repair_service.dto.request.RecordInspectionRequest;
import com.applecare.apple_repair_service.dto.request.WalkInIntakeRequest;
import com.applecare.apple_repair_service.dto.response.ServiceTicketDetailResponse;
import com.applecare.apple_repair_service.dto.response.ServiceTicketSummaryResponse;
import com.applecare.apple_repair_service.dto.response.TicketContextResponse;
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
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
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
    private final com.applecare.apple_repair_service.repository.PartUsageRepository partUsages;

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
        var bookedItems = bookingItems.findAllByAppointmentDevice_Id(device.getId());
        var replacements = r.serviceCatalogItemIds();
        BusinessRules.require(replacements != null ? !replacements.isEmpty() : !bookedItems.isEmpty(),
                "Mỗi thiết bị tiếp nhận phải có ít nhất một dịch vụ cụ thể.");
        if (replacements != null) {
            BusinessRules.require(bookedItems.stream().noneMatch(item -> item.getWarrantySourceItem() != null),
                    "Không thể đổi dịch vụ của lịch hẹn bảo hành tại bước tiếp nhận.");
            BusinessRules.require(new HashSet<>(replacements).size() == replacements.size(), "Dịch vụ được chọn bị trùng.");
            for (var id : replacements) {
                var selected = catalog(id, device.getDeviceModel().getId());
                BusinessRules.require(selected.getServiceType().getCode() == ServiceTypeCode.REPAIR
                                || selected.getServiceType().getCode() == ServiceTypeCode.REPLACEMENT,
                        "Chỉ có thể đổi giữa dịch vụ sửa chữa và thay thế linh kiện.");
            }
        }
        var physical = customers.resolveDevice(appointment.getCustomer().getId(), new CustomerDeviceInfoRequest(device.getDeviceModel().getId(), r.serialNumber(), r.storage()));
        var ticket = newTicket(physical, appointment.getAppointmentSlot().getBranch().getId(), r.createdByUserId(), r.receivedCondition());
        ticket.setAppointmentDevice(device);
        ticket.setCustomerReportedIssue(BusinessRules.text(device.getSymptomDescription()));
        ticket.setDiscountPercent(isDiscountEligible(appointment) ? appointment.getDiscountPercent() : BigDecimal.ZERO);
        tickets.saveAndFlush(ticket);
        if (replacements == null) {
            for (var booked : bookedItems) {
                var item = new RepairItem();
                item.setServiceTicket(ticket);
                item.setServiceCatalogItem(booked.getServiceCatalogItem());
                item.setItemNameSnapshot(booked.getServiceNameSnapshot());
                item.setBasePrice(booked.getBasePriceSnapshot());
                item.setFinalPrice(PricePolicy.discounted(booked.getBasePriceSnapshot(), ticket.getDiscountPercent()));
                item.setWarrantySourceItem(booked.getWarrantySourceItem());
                item.setApprovalStatus(ApprovalStatus.APPROVED);
                repairItems.save(item);
            }
        } else {
            for (var id : replacements) {
                var selected = catalog(id, device.getDeviceModel().getId());
                var item = new RepairItem();
                item.setServiceTicket(ticket);
                item.setServiceCatalogItem(selected);
                item.setItemNameSnapshot(selected.getName());
                var basePrice = PricePolicy.catalogBasePrice(selected);
                item.setBasePrice(basePrice);
                item.setFinalPrice(PricePolicy.discounted(basePrice, ticket.getDiscountPercent()));
                item.setApprovalStatus(ApprovalStatus.APPROVED);
                repairItems.save(item);
            }
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
        CatalogPolicy.requireModel(access.get(DeviceModel.class, r.deviceModelId()));
        var selected = r.serviceCatalogItemIds() == null ? List.<Long>of() : r.serviceCatalogItemIds();
        BusinessRules.require(!selected.isEmpty(), "Mỗi thiết bị tiếp nhận phải có ít nhất một dịch vụ cụ thể.");
        BusinessRules.require(new HashSet<>(selected).size() == selected.size(), "Duplicate selected service");
        selected.forEach(id -> catalog(id, r.deviceModelId()));
        var customer = customers.resolve(r.customerFullName(), r.phone());
        var physical = customers.resolveDevice(customer.getId(), new CustomerDeviceInfoRequest(r.deviceModelId(), r.serialNumber(), r.storage()));
        var ticket = newTicket(physical, r.branchId(), createdByUserId, r.receivedCondition());
        ticket.setCustomerReportedIssue(BusinessRules.text(r.customerReportedIssue()));
        ticket.setAuthorizedScope(BusinessRules.text(r.authorizedScope()));
        tickets.saveAndFlush(ticket);
        for (var id : selected) {
            var c = catalog(id, r.deviceModelId());
            var item = new RepairItem();
            item.setServiceTicket(ticket);
            item.setServiceCatalogItem(c);
            item.setItemNameSnapshot(c.getName());
            var quotedPrice = PricePolicy.catalogBasePrice(c);
            item.setBasePrice(quotedPrice);
            item.setFinalPrice(quotedPrice);
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
        CatalogPolicy.requireUsable(c, model);
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
        var ticket = access.lock(ServiceTicket.class, id);
        BusinessRules.require(ticket.getStatus() == ServiceTicketStatus.WAITING_PART || ticket.getStatus() == ServiceTicketStatus.WAITING_APPROVAL,
                "Chỉ tiếp tục phiếu đang chờ linh kiện hoặc chờ khách xác nhận.");
        BusinessRules.require(statuses.currentWaitResolved(ticket), "Điều kiện chờ chưa được ghi nhận kết thúc.");
        if (ticket.getStatus() == ServiceTicketStatus.WAITING_APPROVAL)
            BusinessRules.require(repairItems.findAllByServiceTicket_Id(id).stream().noneMatch(x -> x.getApprovalStatus() == ApprovalStatus.PENDING),
                    "Phiếu vẫn còn hạng mục chờ ý kiến khách hàng.");
        return move(id, userId, ServiceTicketStatus.REPAIRING, null);
    }

    private static boolean isDiscountEligible(Appointment appointment) {
        if (appointment.getArrivedAt() == null || appointment.getAppointmentSlot() == null) return false;
        var slot = appointment.getAppointmentSlot();
        var start = LocalDateTime.of(slot.getAppointmentDate(), slot.getStartTime());
        var end = LocalDateTime.of(slot.getAppointmentDate(), slot.getEndTime());
        return !appointment.getArrivedAt().isBefore(start) && appointment.getArrivedAt().isBefore(end);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceTicketDetailResponse resolveWait(Long id, Long userId, LocalDateTime resolvedAt, String note) {
        var ticket = access.lock(ServiceTicket.class, id);
        BusinessRules.require(ticket.getStatus() == ServiceTicketStatus.WAITING_PART,
                "Chờ xác nhận khách hàng được giải quyết bằng thao tác ghi nhận quyết định từng hạng mục.");
        statuses.resolveWait(ticket, resolvedAt, access.get(User.class, userId), note);
        return detail(ticket);
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
        BusinessRules.require(t.getPaymentStatus() != PaymentStatus.PAID &&
                (t.getStatus() == ServiceTicketStatus.INSPECTING || t.getStatus() == ServiceTicketStatus.REPAIRING
                 || t.getStatus() == ServiceTicketStatus.WAITING_APPROVAL), "Chỉ cập nhật phương án khi đang kiểm tra, sửa chữa hoặc chờ liên hệ khách.");
        var actor = access.get(User.class, r.inspectedByUserId());
        var current = new ArrayList<>(repairItems.findAllByServiceTicket_Id(id));
        boolean changedScope = current.stream().anyMatch(old -> old.getApprovalStatus() == ApprovalStatus.APPROVED
                && r.items().stream().noneMatch(request -> old.getServiceCatalogItem().getId().equals(request.serviceCatalogItemId())))
                || r.items().stream().anyMatch(request -> current.stream().noneMatch(old ->
                    old.getApprovalStatus() == ApprovalStatus.APPROVED
                    && old.getServiceCatalogItem().getId().equals(request.serviceCatalogItemId())
                    && Objects.equals(old.getWarrantySourceItem() == null ? null : old.getWarrantySourceItem().getId(), request.warrantySourceItemId())
                    && sameAmount(old.getFinalPrice(), request.finalPrice())));
        boolean requiresApproval = r.requiresCustomerApproval();
        if (!requiresApproval && (changedScope || t.getStatus() == ServiceTicketStatus.WAITING_APPROVAL))
            BusinessRules.require(r.confirmationMethod() != null, "Vui lòng ghi nhận khách đã đồng ý trực tiếp, qua điện thoại hoặc trong phạm vi cho phép trước.");
        if (r.confirmationMethod() == com.applecare.apple_repair_service.enums.ConfirmationMethod.PRE_AUTHORIZED)
            BusinessRules.required(t.getAuthorizedScope(), "Phiếu chưa có phạm vi khách cho phép trước");
        var retained = new HashSet<RepairItem>();
        var selected = new HashSet<Long>();
        for (var request : r.items()) {
            BusinessRules.require(selected.add(request.serviceCatalogItemId()), "Duplicate inspected catalog item");
            var c = catalog(request.serviceCatalogItemId(), t.getCustomerDevice().getDeviceModel().getId());
            BusinessRules.require(c.getServiceType().getCode() != ServiceTypeCode.WARRANTY || request.warrantySourceItemId() != null,
                    "Dịch vụ bảo hành cần liên kết với hạng mục gốc.");
            BusinessRules.require(request.finalPrice() != null || request.warrantySourceItemId() != null,
                    "Vui lòng xác định giá hạng mục trước khi gửi phương án cho khách hàng.");
            var item = current.stream()
                    .filter(x -> x.getApprovalStatus() != ApprovalStatus.REJECTED
                            && x.getServiceCatalogItem().getId().equals(c.getId())
                            && (Objects.equals(x.getItemNameSnapshot(), c.getName())
                                || (x.getWarrantySourceItem() != null
                                    && Objects.equals(x.getItemNameSnapshot(), "Bảo hành · " + c.getName())))
                            && sameAmount(x.getBasePrice(), request.basePrice())
                            && sameAmount(x.getFinalPrice(), request.finalPrice())
                            && Objects.equals(x.getWarrantySourceItem() == null ? null : x.getWarrantySourceItem().getId(), request.warrantySourceItemId()))
                    .findFirst().orElseGet(RepairItem::new);
            retained.add(item);
            item.setServiceTicket(t);
            item.setServiceCatalogItem(c);
            if (item.getId() == null || item.getWarrantySourceItem() == null)
                item.setItemNameSnapshot(c.getName());
            item.setBasePrice(request.basePrice());
            item.setFinalPrice(request.finalPrice());
            if (request.warrantySourceItemId() != null) {
                var source = access.get(RepairItem.class, request.warrantySourceItemId());
                BusinessRules.require(!Objects.equals(item.getId(), source.getId()), "Warranty cannot reference itself");
                if (item.getId() == null) warranty.validateBooking(source, t.getCustomerDevice().getCustomer().getId(), c, LocalDate.now(clock));
                item.setWarrantySourceItem(source);
            } else item.setWarrantySourceItem(null);
            if (!requiresApproval || item.getId() == null || item.getApprovalStatus() != ApprovalStatus.APPROVED)
                item.setApprovalStatus(requiresApproval ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED);
            if (!requiresApproval && r.confirmationMethod() != null) {
                item.setApprovalRecordedBy(actor);
                item.setApprovalDecisionAt(LocalDateTime.now(clock));
                item.setConfirmationMethod(r.confirmationMethod());
                item.setApprovalNote(BusinessRules.text(r.confirmationNote()) != null ? r.confirmationNote().trim() : t.getAuthorizedScope());
            }
            repairItems.save(item);
        }
        // Retain previously selected items for traceability, but exclude superseded work from billing.
        for (var old : current)
            if (!retained.contains(old) && old.getApprovalStatus() != ApprovalStatus.REJECTED) {
                BusinessRules.require(partUsages.findAllByRepairItem_Id(old.getId()).stream().noneMatch(u -> u.getStatus() == com.applecare.apple_repair_service.enums.PartUsageStatus.ACTIVE),
                        "Hạng mục đã sử dụng linh kiện không thể bị bỏ hoặc đổi giá. Hãy thêm hạng mục phát sinh riêng.");
                BusinessRules.require(old.getWarrantyDecision() != WarrantyDecision.APPROVED,
                        "Giữ nguyên hạng mục bảo hành đã được chấp nhận; thêm dịch vụ phát sinh thành hạng mục riêng.");
                old.setApprovalStatus(ApprovalStatus.REJECTED);
                old.setApprovalRecordedBy(actor);
                old.setApprovalDecisionAt(LocalDateTime.now(clock));
                old.setApprovalNote("Superseded by inspection plan");
            }
        t.setInspectionResult(r.inspectionResult().trim());
        t.setInspectedBy(actor);
        var next = requiresApproval ? ServiceTicketStatus.WAITING_APPROVAL : ServiceTicketStatus.REPAIRING;
        if (t.getStatus() != next) statuses.changeStatus(t, next, actor, requiresApproval ? "Chờ liên hệ khách hàng" : "Đã ghi nhận phương án và xác nhận nội bộ");
        statuses.planChanged(t, actor);
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
            BusinessRules.require(item.getWarrantyDecision() != WarrantyDecision.REJECTED,
                    "Bảo hành đã bị từ chối. Vui lòng bỏ hạng mục bảo hành khỏi phương án và thêm dịch vụ tính phí đã thỏa thuận.");
            boolean warrantyContext = item.getWarrantySourceItem() != null && item.getWarrantyDecision() == WarrantyDecision.APPROVED;
            boolean replacementWork = warrantyContext
                    ? item.getWarrantyRemedy() == com.applecare.apple_repair_service.enums.WarrantyRemedy.REPLACEMENT
                    : item.getServiceCatalogItem().getServiceType().getCode() == ServiceTypeCode.REPLACEMENT;
            if (replacementWork) {
                var expectedPart = item.getWarrantyReplacementCatalog() == null ? item.getServiceCatalogItem().getPart() : item.getWarrantyReplacementCatalog().getPart();
                BusinessRules.require(expectedPart != null && partUsages.findAllByRepairItem_Id(item.getId()).stream()
                                .anyMatch(usage -> usage.getStatus() == com.applecare.apple_repair_service.enums.PartUsageStatus.ACTIVE
                                        && usage.getQuantity() > 0 && usage.getPart().getId().equals(expectedPart.getId())
                                        && (item.getWarrantyRemedy() != com.applecare.apple_repair_service.enums.WarrantyRemedy.REPLACEMENT || usage.getDefectiveReturnNote() != null)),
                        "Hạng mục thay thế chưa ghi nhận linh kiện sử dụng đúng phương án. Vui lòng xuất linh kiện trước khi hoàn tất sửa chữa.");
            }
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
        var items = repairItems.findAllByServiceTicket_Id(t.getId());
        var device = t.getCustomerDevice();
        var customer = device.getCustomer();
        var model = device.getDeviceModel();
        var context = new TicketContextResponse(customer.getId(), customer.getFullName(), customer.getPhone(), device.getId(),
                model.getId(), model.getName(), model.getDeviceType() == null ? null : model.getDeviceType().getName(), device.getSerialNumber(), device.getStorage(),
                t.getCustomerReportedIssue() != null ? t.getCustomerReportedIssue()
                        : t.getAppointmentDevice() == null ? null : t.getAppointmentDevice().getSymptomDescription(),
                t.getBranch().getId(), t.getBranch().getName(),
                items.stream().map(RepairItem::getServiceCatalogItem).filter(Objects::nonNull)
                        .map(ServiceCatalogItem::getServiceIssue).filter(Objects::nonNull)
                        .map(issue -> issue.getName()).distinct().toList(),
                items.stream().map(RepairItem::getItemNameSnapshot).distinct().toList());
        return new ServiceTicketDetailResponse(mapper.map(t), items.stream().map(mapper::map).toList(),
                histories.findAllByServiceTicket_IdOrderByChangedAtAsc(t.getId()).stream().map(mapper::map).toList(), context);
    }
}
