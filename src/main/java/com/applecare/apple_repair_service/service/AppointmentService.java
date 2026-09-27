package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CancelAppointmentRequest;
import com.applecare.apple_repair_service.dto.request.ConfirmAppointmentRequest;
import com.applecare.apple_repair_service.dto.request.CreateAppointmentRequest;
import com.applecare.apple_repair_service.dto.request.RescheduleAppointmentRequest;
import com.applecare.apple_repair_service.dto.response.AppointmentDetailResponse;
import com.applecare.apple_repair_service.dto.response.AppointmentDeviceDetailResponse;
import com.applecare.apple_repair_service.dto.response.AppointmentSummaryResponse;
import com.applecare.apple_repair_service.entity.Appointment;
import com.applecare.apple_repair_service.entity.AppointmentDevice;
import com.applecare.apple_repair_service.entity.AppointmentServiceItem;
import com.applecare.apple_repair_service.entity.AppointmentSlot;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.AppointmentSlotStatus;
import com.applecare.apple_repair_service.enums.AppointmentStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.exception.InvalidStateTransitionException;
import com.applecare.apple_repair_service.exception.AppointmentExpiredException;
import com.applecare.apple_repair_service.exception.AppointmentTooEarlyException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AppointmentDeviceRepository;
import com.applecare.apple_repair_service.repository.AppointmentRepository;
import com.applecare.apple_repair_service.repository.AppointmentServiceItemRepository;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AppointmentService {
    private final AppointmentRepository appointments;
    private final AppointmentDeviceRepository devices;
    private final AppointmentServiceItemRepository items;
    private final ServiceTicketRepository tickets;
    private final CustomerIdentity customers;
    private final SystemSettingService settings;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final WarrantyPolicy warranty;
    private final EntityResponses mapper;
    private final Clock clock;
    private final RetryingWrites writes;

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.SUPPORTS)
    public AppointmentDetailResponse createAppointment(CreateAppointmentRequest r) {
        return writes.execute(() -> createInTransaction(r));
    }

    private AppointmentDetailResponse createInTransaction(CreateAppointmentRequest r) {
        rules.validate(r);
        var slot = validSlot(r.appointmentSlotId());
        var discount = settings.getDecimal(PricePolicy.ONLINE_BOOKING_DISCOUNT_PERCENT, PricePolicy.DEFAULT_ONLINE_DISCOUNT);
        PricePolicy.discounted(null, discount);
        // Validate the complete plan before resolving/creating the customer.
        for (var d : r.devices()) {
            CatalogPolicy.requireModel(access.get(DeviceModel.class, d.deviceModelId()));
            var seen = new HashSet<Long>();
            for (var i : d.serviceItems()) {
                BusinessRules.require(seen.add(i.serviceCatalogItemId()), "Thiết bị có dịch vụ bị chọn trùng.");
                validCatalog(i.serviceCatalogItemId(), d.deviceModelId());
            }
        }
        var customer = customers.resolve(r.customerFullName(), r.phone());
        var a = new Appointment();
        a.setCustomer(customer);
        a.setAppointmentSlot(slot);
        a.setDiscountPercent(discount);
        a.setNote(BusinessRules.text(r.note()));
        a.setBookedAt(LocalDateTime.now(clock));
        appointments.save(a);
        for (var d : r.devices()) {
            var device = new AppointmentDevice();
            device.setAppointment(a);
            device.setDeviceModel(access.get(DeviceModel.class, d.deviceModelId()));
            device.setSymptomDescription(BusinessRules.text(d.symptomDescription()));
            devices.save(device);
            for (var request : d.serviceItems()) {
                var catalog = validCatalog(request.serviceCatalogItemId(), d.deviceModelId());
                BusinessRules.require(catalog.getServiceType().getCode() != ServiceTypeCode.WARRANTY
                                || request.warrantySourceItemId() != null,
                        "Vui lòng chọn dịch vụ gốc còn bảo hành trước khi đặt lịch bảo hành.");
                var item = new AppointmentServiceItem();
                item.setAppointmentDevice(device);
                item.setServiceCatalogItem(catalog);
                item.setServiceNameSnapshot(catalog.getName());
                var basePrice = PricePolicy.catalogBasePrice(catalog);
                item.setBasePriceSnapshot(basePrice);
                item.setFinalPriceSnapshot(PricePolicy.discounted(basePrice, discount));
                if (request.warrantySourceItemId() != null) {
                    var source = access.get(RepairItem.class, request.warrantySourceItemId());
                    warranty.validateBooking(source, customer.getId(), catalog, LocalDate.now(clock));
                    item.setWarrantySourceItem(source);
                }
                items.save(item);
            }
        }
        appointments.flush();
        return detail(a);
    }

    private AppointmentSlot validSlot(Long id) {
        var s = access.get(AppointmentSlot.class, id);
        BusinessRules.require(s.getBranch() != null && s.getBranch().getStatus() == ActiveStatus.ACTIVE,
                "Chi nhánh của khung giờ đã ngừng hoạt động. Vui lòng chọn khung giờ khác.");
        BusinessRules.require(s.getStatus() == AppointmentSlotStatus.OPEN, "Khung giờ đã đóng. Vui lòng chọn khung giờ khác.");
        BusinessRules.require(!LocalDateTime.of(s.getAppointmentDate(), s.getStartTime()).isBefore(LocalDateTime.now(clock)), "Khung giờ đã bắt đầu hoặc đã qua.");
        return s;
    }

    private ServiceCatalogItem validCatalog(Long id, Long modelId) {
        var c = access.get(ServiceCatalogItem.class, id);
        CatalogPolicy.requireUsable(c, modelId);
        return c;
    }

    public long countActiveBookings(Long slotId) {
        access.get(AppointmentSlot.class, slotId);
        return appointments.countByAppointmentSlot_IdAndStatusNotIn(slotId, List.of(AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED));
    }

    public AppointmentDetailResponse getById(Long id) {
        return detail(access.get(Appointment.class, id));
    }

    public List<AppointmentDetailResponse> list(Long branchId, java.time.LocalDate date, com.applecare.apple_repair_service.enums.AppointmentStatus status) {
        return appointments.findFiltered(branchId, date, status).stream().map(this::detail).toList();
    }

    public List<AppointmentDetailResponse> readyForIntake() {
        return appointments.findFiltered(null, null, AppointmentStatus.ARRIVED).stream()
                .map(appointment -> new AppointmentDetailResponse(mapper.map(appointment),
                        devices.findAllByAppointment_Id(appointment.getId()).stream()
                                .filter(device -> tickets.findByAppointmentDevice_Id(device.getId()).isEmpty())
                                .map(device -> new AppointmentDeviceDetailResponse(mapper.map(device),
                                        items.findAllByAppointmentDevice_Id(device.getId()).stream().map(mapper::map).toList()))
                                .toList()))
                .filter(detail -> !detail.devices().isEmpty()).toList();
    }

    public List<AppointmentSummaryResponse> findByPhone(String phone) {
        return appointments.findAllByCustomer_PhoneOrderByBookedAtDesc(BusinessRules.required(phone, "Phone")).stream().map(a -> new AppointmentSummaryResponse(a.getId(), a.getCustomer().getId(), a.getAppointmentSlot().getId(), a.getStatus(), a.getBookedAt())).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public AppointmentDetailResponse confirmAppointment(Long id, ConfirmAppointmentRequest r) {
        rules.validate(r);
        var a = access.lock(Appointment.class, id);
        if (a.getStatus() == AppointmentStatus.CONFIRMED) return detail(a);
        transition(a, AppointmentStatus.CONFIRMED);
        a.setConfirmedBy(access.get(User.class, r.confirmedByUserId()));
        a.setConfirmedAt(LocalDateTime.now(clock));
        return detail(a);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public AppointmentDetailResponse rescheduleAppointment(Long id, RescheduleAppointmentRequest r) {
        rules.validate(r);
        var a = access.lock(Appointment.class, id);
        requireOpen(a);
        a.setAppointmentSlot(validSlot(r.appointmentSlotId()));
        return detail(a);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public AppointmentDetailResponse cancelAppointment(Long id, CancelAppointmentRequest r) {
        rules.validate(r);
        var a = access.lock(Appointment.class, id);
        transition(a, AppointmentStatus.CANCELLED);
        a.setCancelReason(BusinessRules.text(r.reason()));
        return detail(a);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public AppointmentDetailResponse expireAppointment(Long id) {
        var a = access.lock(Appointment.class, id);
        requireOpen(a);
        var slotEnd = LocalDateTime.of(a.getAppointmentSlot().getAppointmentDate(), a.getAppointmentSlot().getEndTime());
        BusinessRules.require(!LocalDateTime.now(clock).isBefore(slotEnd),
                "Lịch hẹn chưa kết thúc nên chưa thể đánh dấu hết hiệu lực.");
        transition(a, AppointmentStatus.EXPIRED);
        return detail(a);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED,
            noRollbackFor = AppointmentExpiredException.class)
    public AppointmentDetailResponse markArrived(Long id) {
        var a = access.lock(Appointment.class, id);
        if (a.getStatus() == AppointmentStatus.ARRIVED) return detail(a);
        if (a.getStatus() != AppointmentStatus.CONFIRMED)
            throw new InvalidStateTransitionException("Lịch hẹn cần được xác nhận trước khi ghi nhận khách đến.");
        var now = LocalDateTime.now(clock);
        var slot = a.getAppointmentSlot();
        var start = LocalDateTime.of(slot.getAppointmentDate(), slot.getStartTime());
        var end = LocalDateTime.of(slot.getAppointmentDate(), slot.getEndTime());
        var label = slot.getStartTime().toString().substring(0, 5) + "–" + slot.getEndTime().toString().substring(0, 5);
        if (now.isBefore(start))
            throw new AppointmentTooEarlyException("Chưa đến khung giờ tiếp nhận. Lịch hẹn có hiệu lực từ " + label + ".");
        if (!now.isBefore(end)) {
            transition(a, AppointmentStatus.EXPIRED);
            appointments.flush();
            throw new AppointmentExpiredException("Đã quá khung giờ " + label
                    + ". Lịch hẹn không còn đủ điều kiện hưởng ưu đãi đặt lịch.");
        }
        transition(a, AppointmentStatus.ARRIVED);
        a.setArrivedAt(now);
        return detail(a);
    }

    private void requireOpen(Appointment a) {
        if (a.getStatus() != AppointmentStatus.PENDING_CONFIRMATION && a.getStatus() != AppointmentStatus.CONFIRMED)
            throw new InvalidStateTransitionException("Lịch hẹn không còn ở trạng thái có thể thao tác.");
    }

    private void transition(Appointment a, AppointmentStatus next) {
        boolean allowed = switch (a.getStatus()) {
            case PENDING_CONFIRMATION ->
                    Set.of(AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED).contains(next);
            case CONFIRMED ->
                    Set.of(AppointmentStatus.ARRIVED, AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED).contains(next);
            default -> false;
        };
        if (!allowed) throw new InvalidStateTransitionException("Lịch hẹn đã thay đổi trạng thái. Vui lòng tải lại thông tin trước khi thao tác.");
        a.setStatus(next);
    }

    private AppointmentDetailResponse detail(Appointment a) {
        return new AppointmentDetailResponse(mapper.map(a), devices.findAllByAppointment_Id(a.getId()).stream()
                .map(d -> new AppointmentDeviceDetailResponse(mapper.map(d), items.findAllByAppointmentDevice_Id(d.getId()).stream().map(mapper::map).toList())).toList());
    }
}
