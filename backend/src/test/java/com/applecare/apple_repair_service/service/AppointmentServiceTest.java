package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.AppointmentDeviceRequest;
import com.applecare.apple_repair_service.dto.request.AppointmentServiceItemRequest;
import com.applecare.apple_repair_service.dto.request.CancelAppointmentRequest;
import com.applecare.apple_repair_service.dto.request.ConfirmAppointmentRequest;
import com.applecare.apple_repair_service.dto.request.CreateAppointmentRequest;
import com.applecare.apple_repair_service.dto.request.RescheduleAppointmentRequest;
import com.applecare.apple_repair_service.entity.Appointment;
import com.applecare.apple_repair_service.entity.AppointmentDevice;
import com.applecare.apple_repair_service.entity.AppointmentServiceItem;
import com.applecare.apple_repair_service.entity.AppointmentSlot;
import com.applecare.apple_repair_service.entity.Customer;
import com.applecare.apple_repair_service.entity.CustomerDevice;
import com.applecare.apple_repair_service.entity.DeviceModel;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.ServiceType;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.AppointmentSlotStatus;
import com.applecare.apple_repair_service.enums.AppointmentStatus;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.exception.InvalidStateTransitionException;
import com.applecare.apple_repair_service.exception.AppointmentExpiredException;
import com.applecare.apple_repair_service.exception.AppointmentTooEarlyException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AppointmentDeviceRepository;
import com.applecare.apple_repair_service.repository.AppointmentRepository;
import com.applecare.apple_repair_service.repository.AppointmentServiceItemRepository;
import jakarta.validation.Validation;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AppointmentServiceTest {
    final Clock clock = Clock.fixed(Instant.parse("2026-09-11T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    final AppointmentRepository appointments = mock(AppointmentRepository.class);
    final AppointmentDeviceRepository devices = mock(AppointmentDeviceRepository.class);
    final AppointmentServiceItemRepository items = mock(AppointmentServiceItemRepository.class);
    final com.applecare.apple_repair_service.repository.ServiceTicketRepository tickets = mock(com.applecare.apple_repair_service.repository.ServiceTicketRepository.class);
    final com.applecare.apple_repair_service.repository.ServiceCatalogItemRepository catalogRepository = mock(com.applecare.apple_repair_service.repository.ServiceCatalogItemRepository.class);
    final CustomerIdentity customers = mock(CustomerIdentity.class);
    final SystemSettingService settings = mock(SystemSettingService.class);
    final DomainAccess access = mock(DomainAccess.class);
    final WarrantyPolicy warranty = new WarrantyPolicy();
    final AppointmentService service = new AppointmentService(appointments, devices, items, tickets, catalogRepository, customers, settings, access,
            new BusinessRules(Validation.buildDefaultValidatorFactory().getValidator()), warranty, new EntityResponses(), clock, new RetryingWrites(new WriteTransaction()));
    final AppointmentSlot slot = new AppointmentSlot();
    final DeviceModel model = new DeviceModel();
    final Customer customer = new Customer();
    final List<AppointmentDevice> savedDevices = new ArrayList<>();
    final List<AppointmentServiceItem> savedItems = new ArrayList<>();

    @BeforeEach
    void setup() {
        slot.setId(1L);
        slot.setBranch(TestData.branch(1));
        slot.setAppointmentDate(LocalDate.now(clock));
        slot.setStartTime(LocalTime.of(11, 0));
        slot.setEndTime(LocalTime.NOON);
        model.setId(2L);
        var deviceType = new com.applecare.apple_repair_service.entity.DeviceType();
        deviceType.setId(1L);
        model.setDeviceType(deviceType);
        customer.setId(3L);
        when(access.get(AppointmentSlot.class, 1L)).thenReturn(slot);
        when(access.get(DeviceModel.class, 2L)).thenReturn(model);
        when(customers.resolve(anyString(), anyString())).thenReturn(customer);
        when(settings.getDecimal(eq(PricePolicy.ONLINE_BOOKING_DISCOUNT_PERCENT), any())).thenReturn(PricePolicy.DEFAULT_ONLINE_DISCOUNT);
        when(appointments.save(any())).thenAnswer(i -> {
            Appointment a = i.getArgument(0);
            a.setId(10L);
            return a;
        });
        when(devices.save(any())).thenAnswer(i -> {
            AppointmentDevice d = i.getArgument(0);
            d.setId(20L + savedDevices.size());
            savedDevices.add(d);
            return d;
        });
        when(items.save(any())).thenAnswer(i -> {
            AppointmentServiceItem s = i.getArgument(0);
            s.setId(30L + savedItems.size());
            savedItems.add(s);
            return s;
        });
        when(devices.findAllByAppointment_Id(any())).thenAnswer(i -> savedDevices);
        when(items.findAllByAppointmentDevice_Id(any())).thenAnswer(i -> savedItems.stream().filter(s -> s.getAppointmentDevice().getId().equals(i.getArgument(0))).toList());
        catalog(4L, model);
        catalog(5L, model);
    }

    ServiceCatalogItem catalog(Long id, DeviceModel m) {
        var c = new ServiceCatalogItem();
        c.setId(id);
        c.setName("Service");
        c.setDeviceModel(m);
        c.setConfiguredPrice(new BigDecimal("100.05"));
        c.setStandardDurationMinutes(30);
        var type = new ServiceType();
        type.setCode(ServiceTypeCode.REPAIR);
        c.setServiceType(type);
        var issue = new com.applecare.apple_repair_service.entity.ServiceIssue();
        issue.setId(1L);
        issue.getDeviceTypes().add(m.getDeviceType());
        c.setServiceIssue(issue);
        when(access.get(ServiceCatalogItem.class, id)).thenReturn(c);
        return c;
    }

    CreateAppointmentRequest request(List<AppointmentDeviceRequest> ds) {
        return new CreateAppointmentRequest("An", "0901", 1L, null, ds);
    }

    AppointmentDeviceRequest device(Long... ids) {
        return new AppointmentDeviceRequest(2L, null, Arrays.stream(ids).map(id -> new AppointmentServiceItemRequest(id, null)).toList());
    }

    Appointment appointment(AppointmentStatus status) {
        var a = new Appointment();
        a.setId(10L);
        a.setCustomer(customer);
        a.setAppointmentSlot(slot);
        a.setStatus(status);
        when(access.lock(Appointment.class, 10L)).thenReturn(a);
        return a;
    }

    @Test
    void staleInactiveBranchCannotBeBooked() {
        slot.getBranch().setStatus(com.applecare.apple_repair_service.enums.ActiveStatus.INACTIVE);
        assertThrows(BusinessRuleViolationException.class, () -> service.createAppointment(request(List.of(device(4L)))));
        verifyNoInteractions(customers);
    }

    @Test
    void staleMasterAndInvalidIssueMappingCannotBeBooked() {
        var c = catalog(40L, model);
        var inactive = com.applecare.apple_repair_service.enums.ActiveStatus.INACTIVE;
        var active = com.applecare.apple_repair_service.enums.ActiveStatus.ACTIVE;
        for (int field = 0; field < 6; field++) {
            c.setStatus(active); model.setStatus(active); model.getDeviceType().setStatus(active);
            c.getServiceIssue().setStatus(active); c.getServiceType().setStatus(active);
            c.getServiceIssue().getDeviceTypes().add(model.getDeviceType());
            switch (field) {
                case 0 -> c.setStatus(inactive);
                case 1 -> model.setStatus(inactive);
                case 2 -> model.getDeviceType().setStatus(inactive);
                case 3 -> c.getServiceIssue().setStatus(inactive);
                case 4 -> c.getServiceType().setStatus(inactive);
                case 5 -> c.getServiceIssue().getDeviceTypes().clear();
            }
            assertThrows(BusinessRuleViolationException.class, () -> service.createAppointment(request(List.of(device(40L)))));
        }
        verifyNoInteractions(customers);
    }

    @Test
    void replacementRequiresActiveCatalogPart() {
        var c = catalog(40L, model);
        c.getServiceType().setCode(ServiceTypeCode.REPLACEMENT);
        assertThrows(BusinessRuleViolationException.class, () -> service.createAppointment(request(List.of(device(40L)))));
        var part = new com.applecare.apple_repair_service.entity.Part();
        part.setStatus(com.applecare.apple_repair_service.enums.ActiveStatus.INACTIVE);
        c.setPart(part);
        assertThrows(BusinessRuleViolationException.class, () -> service.createAppointment(request(List.of(device(40L)))));
        verifyNoInteractions(customers);
    }

    @Test
    void multipleDevicesAndServicesSnapshotDiscount() {
        var result = service.createAppointment(request(List.of(device(4L, 5L), device(4L))));
        assertEquals(2, result.devices().size());
        assertEquals(3, savedItems.size());
        assertEquals(new BigDecimal("90.05"), savedItems.getFirst().getFinalPriceSnapshot());
        assertEquals(new BigDecimal("10.00"), result.appointment().discountPercent());
    }

    @Test
    void zeroDiscountAndChangedSettingAreSnapshottedPerBooking() {
        when(settings.getDecimal(PricePolicy.ONLINE_BOOKING_DISCOUNT_PERCENT, PricePolicy.DEFAULT_ONLINE_DISCOUNT))
                .thenReturn(BigDecimal.ZERO, new BigDecimal("10.00"), new BigDecimal("5.00"));
        var zero = service.createAppointment(request(List.of(device(4L))));
        assertEquals(new BigDecimal("0"), zero.appointment().discountPercent());
        assertEquals(new BigDecimal("100.05"), savedItems.getFirst().getFinalPriceSnapshot());
        var ten = service.createAppointment(request(List.of(device(4L))));
        var tenItem = savedItems.get(1);
        assertEquals(new BigDecimal("10.00"), ten.appointment().discountPercent());
        assertEquals(new BigDecimal("90.05"), tenItem.getFinalPriceSnapshot());
        var five = service.createAppointment(request(List.of(device(4L))));
        assertEquals(new BigDecimal("5.00"), five.appointment().discountPercent());
        assertEquals(new BigDecimal("95.05"), savedItems.get(2).getFinalPriceSnapshot());
        assertEquals(new BigDecimal("10.00"), ten.appointment().discountPercent());
        assertEquals(new BigDecimal("90.05"), tenItem.getFinalPriceSnapshot());
    }

    @Test
    void unknownPriceRemainsNull() {
        catalog(4L, model).setConfiguredPrice(null);
        service.createAppointment(request(List.of(device(4L))));
        assertNull(savedItems.getFirst().getFinalPriceSnapshot());
    }

    @Test
    void wrongModelRejected() {
        var other = new DeviceModel();
        other.setId(9L);
        catalog(4L, other);
        assertThrows(BusinessRuleViolationException.class, () -> service.createAppointment(request(List.of(device(4L)))));
        verifyNoInteractions(customers);
    }

    @Test
    void closedSlotRejected() {
        slot.setStatus(AppointmentSlotStatus.CLOSED);
        assertThrows(BusinessRuleViolationException.class, () -> service.createAppointment(request(List.of(device(4L)))));
    }

    @Test
    void countExcludesCancelledAndExpired() {
        when(appointments.countByAppointmentSlot_IdAndStatusNotIn(1L, List.of(AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED))).thenReturn(7L);
        assertEquals(7, service.countActiveBookings(1L));
    }

    @Test
    void confirmThenArrive() {
        var a = appointment(AppointmentStatus.PENDING_CONFIRMATION);
        slot.setStartTime(LocalTime.of(10, 0));
        slot.setEndTime(LocalTime.of(11, 0));
        var user = new User();
        when(access.get(User.class, 1L)).thenReturn(user);
        service.confirmAppointment(10L, new ConfirmAppointmentRequest(1L));
        assertEquals(AppointmentStatus.CONFIRMED, a.getStatus());
        assertNotNull(a.getConfirmedAt());
        service.markArrived(10L);
        assertEquals(AppointmentStatus.ARRIVED, a.getStatus());
        assertEquals(java.time.LocalDateTime.now(clock), a.getArrivedAt());
    }

    @Test
    void pendingCannotArrive() {
        appointment(AppointmentStatus.PENDING_CONFIRMATION);
        assertThrows(InvalidStateTransitionException.class, () -> service.markArrived(10L));
    }

    @Test
    void terminalCannotCancel() {
        appointment(AppointmentStatus.ARRIVED);
        assertThrows(InvalidStateTransitionException.class, () -> service.cancelAppointment(10L, new CancelAppointmentRequest(null)));
    }

    @Test
    void expirationUsesSlotEndWithoutGracePeriod() {
        var a = appointment(AppointmentStatus.CONFIRMED);
        slot.setStartTime(LocalTime.of(9, 0));
        slot.setEndTime(LocalTime.of(10, 0, 1));
        assertThrows(BusinessRuleViolationException.class, () -> service.expireAppointment(10L));
        slot.setEndTime(LocalTime.of(10, 0));
        service.expireAppointment(10L);
        assertEquals(AppointmentStatus.EXPIRED, a.getStatus());
    }

    @Test
    void arrivalHonorsBothSlotBoundaries() {
        var early = appointment(AppointmentStatus.CONFIRMED);
        slot.setStartTime(LocalTime.of(10, 0, 1));
        slot.setEndTime(LocalTime.of(11, 0));
        assertThrows(AppointmentTooEarlyException.class, () -> service.markArrived(10L));
        assertEquals(AppointmentStatus.CONFIRMED, early.getStatus());

        var valid = appointment(AppointmentStatus.CONFIRMED);
        slot.setStartTime(LocalTime.of(9, 0));
        slot.setEndTime(LocalTime.of(10, 0, 1));
        service.markArrived(10L);
        assertEquals(AppointmentStatus.ARRIVED, valid.getStatus());

        var late = appointment(AppointmentStatus.CONFIRMED);
        slot.setEndTime(LocalTime.of(10, 0));
        assertThrows(AppointmentExpiredException.class, () -> service.markArrived(10L));
        assertEquals(AppointmentStatus.EXPIRED, late.getStatus());
        assertNull(late.getArrivedAt());
    }

    @Test
    void rescheduleUsesNewSlotWindow() {
        var a = appointment(AppointmentStatus.CONFIRMED);
        var newSlot = new AppointmentSlot();
        newSlot.setId(2L);
        newSlot.setBranch(TestData.branch(1));
        newSlot.setAppointmentDate(LocalDate.now(clock));
        newSlot.setStartTime(LocalTime.of(10, 0));
        newSlot.setEndTime(LocalTime.of(10, 30));
        when(access.get(AppointmentSlot.class, 2L)).thenReturn(newSlot);
        service.rescheduleAppointment(10L, new RescheduleAppointmentRequest(2L));
        service.markArrived(10L);
        assertEquals(newSlot, a.getAppointmentSlot());
        assertEquals(AppointmentStatus.ARRIVED, a.getStatus());
    }

    RepairItem source() {
        var physical = new CustomerDevice();
        physical.setCustomer(customer);
        physical.setDeviceModel(model);
        var t = new ServiceTicket();
        t.setCustomerDevice(physical);
        t.setStatus(ServiceTicketStatus.HANDED_OVER);
        var source = new RepairItem();
        source.setId(99L);
        source.setServiceTicket(t);
        source.setApprovalStatus(ApprovalStatus.APPROVED);
        source.setWarrantyStartDate(LocalDate.now(clock));
        source.setWarrantyEndDate(LocalDate.now(clock).plusDays(30));
        when(access.get(RepairItem.class, 99L)).thenReturn(source);
        return source;
    }

    @Test
    void validWarrantyBookingKeepsSource() {
        var source = source();
        var original = catalog(4L, model);
        original.getServiceType().setCode(ServiceTypeCode.REPAIR);
        original.setWarrantyDays(30);
        original.setWarrantyRemedy(com.applecare.apple_repair_service.enums.WarrantyRemedy.REPAIR);
        source.setServiceCatalogItem(original);
        when(access.get(RepairItem.class, 99L)).thenReturn(source);
        when(access.get(DeviceModel.class, 2L)).thenReturn(model);
        when(catalogRepository.findAllByDeviceModel_IdAndServiceIssue_Id(2L, original.getServiceIssue().getId())).thenReturn(List.of(original));
        service.createAppointment(request(List.of(new AppointmentDeviceRequest(2L, null, List.of(new AppointmentServiceItemRequest(null, 99L))))));
        assertEquals(99L, savedItems.getFirst().getWarrantySourceItem().getId());
        assertEquals(99L, savedItems.getFirst().getWarrantySourceItem().getId());
        assertEquals(0, BigDecimal.ZERO.compareTo(savedItems.getFirst().getBasePriceSnapshot()));
        assertEquals(0, BigDecimal.ZERO.compareTo(savedItems.getFirst().getFinalPriceSnapshot()));
    }

    @Test
    void warrantyBookingRequiresCoveredSource() {
        catalog(4L, model).getServiceType().setCode(ServiceTypeCode.WARRANTY);
        assertThrows(BusinessRuleViolationException.class, () -> service.createAppointment(
                request(List.of(new AppointmentDeviceRequest(2L, null,
                        List.of(new AppointmentServiceItemRequest(4L, null)))))));
    }

    @Test
    void expiredWarrantyRejected() {
        var s = source();
        s.setWarrantyEndDate(LocalDate.now(clock).minusDays(1));
        var original = catalog(4L, model);
        original.getServiceType().setCode(ServiceTypeCode.REPAIR);
        original.setWarrantyDays(30);
        original.setWarrantyRemedy(com.applecare.apple_repair_service.enums.WarrantyRemedy.REPAIR);
        s.setServiceCatalogItem(original);
        when(access.get(DeviceModel.class, 2L)).thenReturn(model);
        when(access.get(RepairItem.class, 99L)).thenReturn(s);
        when(access.get(DeviceModel.class, 2L)).thenReturn(model);
        when(catalogRepository.findAllByDeviceModel_IdAndServiceIssue_Id(2L, original.getServiceIssue().getId())).thenReturn(List.of(original));
        assertThrows(BusinessRuleViolationException.class, () -> service.createAppointment(request(List.of(
                new AppointmentDeviceRequest(2L, null, List.of(new AppointmentServiceItemRequest(null, 99L)))))));
    }

    @Test
    void fallbackPriceAndRounding() {
        assertEquals(new BigDecimal("90.05"), PricePolicy.discounted(new BigDecimal("100.05"), PricePolicy.DEFAULT_ONLINE_DISCOUNT));
    }

    @Test
    void discountCannotBeSilentlyRoundedInSnapshot() {
        assertThrows(BusinessRuleViolationException.class, () -> PricePolicy.discounted(new BigDecimal("10000"), new BigDecimal("10.123")));
    }
}
