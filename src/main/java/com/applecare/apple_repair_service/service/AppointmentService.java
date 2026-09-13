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
import com.applecare.apple_repair_service.exception.InvalidStateTransitionException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AppointmentDeviceRepository;
import com.applecare.apple_repair_service.repository.AppointmentRepository;
import com.applecare.apple_repair_service.repository.AppointmentServiceItemRepository;

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
        var discount = settings.getDecimal("ONLINE_DISCOUNT_PERCENT", PricePolicy.DEFAULT_ONLINE_DISCOUNT);
        PricePolicy.discounted(null, discount);
        // Validate the complete plan before resolving/creating the customer.
        for (var d : r.devices()) {
            access.get(DeviceModel.class, d.deviceModelId());
            var seen = new HashSet<Long>();
            for (var i : d.serviceItems()) {
                BusinessRules.require(seen.add(i.serviceCatalogItemId()), "Duplicate service for booking device");
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
                var item = new AppointmentServiceItem();
                item.setAppointmentDevice(device);
                item.setServiceCatalogItem(catalog);
                item.setServiceNameSnapshot(catalog.getName());
                item.setBasePriceSnapshot(catalog.getConfiguredPrice());
                item.setFinalPriceSnapshot(PricePolicy.discounted(catalog.getConfiguredPrice(), discount));
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
        BusinessRules.require(s.getStatus() == AppointmentSlotStatus.OPEN, "Slot is closed");
        BusinessRules.require(!LocalDateTime.of(s.getAppointmentDate(), s.getStartTime()).isBefore(LocalDateTime.now(clock)), "Slot is in the past");
        return s;
    }

    private ServiceCatalogItem validCatalog(Long id, Long modelId) {
        var c = access.get(ServiceCatalogItem.class, id);
        BusinessRules.require(c.getStatus() == ActiveStatus.ACTIVE, "Catalog is inactive");
        BusinessRules.require(c.getDeviceModel().getId().equals(modelId), "Catalog does not match device model");
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

    public List<AppointmentSummaryResponse> findByPhone(String phone) {
        return appointments.findAllByCustomer_PhoneOrderByBookedAtDesc(BusinessRules.required(phone, "Phone")).stream().map(a -> new AppointmentSummaryResponse(a.getId(), a.getCustomer().getId(), a.getAppointmentSlot().getId(), a.getStatus(), a.getBookedAt())).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public AppointmentDetailResponse confirmAppointment(Long id, ConfirmAppointmentRequest r) {
        rules.validate(r);
        var a = access.lock(Appointment.class, id);
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
        int grace = settings.getInteger("APPOINTMENT_GRACE_MINUTES");
        BusinessRules.require(grace >= 0, "Grace minutes cannot be negative");
        var deadline = LocalDateTime.of(a.getAppointmentSlot().getAppointmentDate(), a.getAppointmentSlot().getStartTime()).plusMinutes(grace);
        BusinessRules.require(LocalDateTime.now(clock).isAfter(deadline), "Appointment has not exceeded grace");
        transition(a, AppointmentStatus.EXPIRED);
        return detail(a);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public AppointmentDetailResponse markArrived(Long id) {
        var a = access.lock(Appointment.class, id);
        transition(a, AppointmentStatus.ARRIVED);
        return detail(a);
    }

    private void requireOpen(Appointment a) {
        if (a.getStatus() != AppointmentStatus.PENDING_CONFIRMATION && a.getStatus() != AppointmentStatus.CONFIRMED)
            throw new InvalidStateTransitionException("Appointment is no longer open");
    }

    private void transition(Appointment a, AppointmentStatus next) {
        boolean allowed = switch (a.getStatus()) {
            case PENDING_CONFIRMATION ->
                    Set.of(AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED).contains(next);
            case CONFIRMED ->
                    Set.of(AppointmentStatus.ARRIVED, AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED).contains(next);
            default -> false;
        };
        if (!allowed) throw new InvalidStateTransitionException(a.getStatus() + " -> " + next);
        a.setStatus(next);
    }

    private AppointmentDetailResponse detail(Appointment a) {
        return new AppointmentDetailResponse(mapper.map(a), devices.findAllByAppointment_Id(a.getId()).stream()
                .map(d -> new AppointmentDeviceDetailResponse(mapper.map(d), items.findAllByAppointmentDevice_Id(d.getId()).stream().map(mapper::map).toList())).toList());
    }
}
