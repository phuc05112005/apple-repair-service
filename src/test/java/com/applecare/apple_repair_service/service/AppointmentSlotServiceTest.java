package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.dto.request.SaveAppointmentSlotRequest;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.exception.*;
import com.applecare.apple_repair_service.repository.*;
import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class AppointmentSlotServiceTest {
    final AppointmentSlotRepository slots = mock(AppointmentSlotRepository.class);
    final AppointmentRepository appointments = mock(AppointmentRepository.class);
    final DomainAccess access = mock(DomainAccess.class);
    final AppointmentSlotService service = new AppointmentSlotService(slots, appointments, access,
            new BusinessRules(Validation.buildDefaultValidatorFactory().getValidator()), TestData.CLOCK);
    final Branch branch = TestData.branch(1);
    final LocalDate date = LocalDate.now(TestData.CLOCK);
    @BeforeEach void setup() {
        when(access.get(Branch.class, 1L)).thenReturn(branch);
        when(slots.saveAndFlush(any())).thenAnswer(invocation -> {
            AppointmentSlot slot = invocation.getArgument(0); slot.setId(2L); return slot;
        });
    }
    SaveAppointmentSlotRequest request(LocalTime start, LocalTime end) {
        return new SaveAppointmentSlotRequest(1L, date, start, end);
    }
    AppointmentSlot slot() {
        var slot = new AppointmentSlot(); slot.setId(2L); slot.setBranch(branch);
        slot.setAppointmentDate(date); slot.setStartTime(LocalTime.of(11, 0)); slot.setEndTime(LocalTime.NOON);
        return slot;
    }
    @Test void createsOpenSlotAndCountsOnlyActiveBookings() {
        when(appointments.countByAppointmentSlot_IdAndStatusNotIn(2L, List.of(AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED))).thenReturn(7L);
        var response = service.create(request(LocalTime.of(11,0), LocalTime.NOON));
        assertEquals(AppointmentSlotStatus.OPEN, response.status()); assertEquals(7L, response.activeBookingCount());
        verify(appointments).countByAppointmentSlot_IdAndStatusNotIn(2L, List.of(AppointmentStatus.CANCELLED, AppointmentStatus.EXPIRED));
    }
    @Test void rejectsEqualOrReversedTimes() {
        assertThrows(BusinessRuleViolationException.class, () -> service.create(request(LocalTime.NOON, LocalTime.NOON)));
        assertThrows(BusinessRuleViolationException.class, () -> service.create(request(LocalTime.NOON, LocalTime.of(11,0))));
        verify(slots, never()).saveAndFlush(any());
    }
    @Test void rejectsDuplicateBeforePersistence() {
        when(slots.findByBranch_IdAndAppointmentDateAndStartTimeAndEndTime(1L,date,LocalTime.of(11,0),LocalTime.NOON)).thenReturn(Optional.of(slot()));
        assertThrows(DuplicateResourceException.class, () -> service.create(request(LocalTime.of(11,0),LocalTime.NOON)));
    }
    @Test void inactiveBranchCannotCreateOrPublishAvailability() {
        branch.setStatus(ActiveStatus.INACTIVE);
        assertThrows(BusinessRuleViolationException.class, () -> service.create(request(LocalTime.of(11,0),LocalTime.NOON)));
        assertTrue(service.availability(1L,date).isEmpty());
    }
    @Test void publicQueryOnlyOpenFutureSlotsAndCloseIsReversible() {
        var slot=slot(); when(access.lock(AppointmentSlot.class,2L)).thenReturn(slot);
        assertEquals(AppointmentSlotStatus.CLOSED,service.close(2L).status());
        when(slots.findAllByBranch_IdAndAppointmentDateAndStatusOrderByStartTime(1L,date,AppointmentSlotStatus.OPEN)).thenReturn(List.of());
        assertTrue(service.availability(1L,date).isEmpty());
        service.open(2L);
        when(slots.findAllByBranch_IdAndAppointmentDateAndStatusOrderByStartTime(1L,date,AppointmentSlotStatus.OPEN)).thenReturn(List.of(slot));
        assertEquals(1,service.availability(1L,date).size());
        slot.setStartTime(LocalTime.of(9,0));
        assertTrue(service.availability(1L,date).isEmpty());
    }
    @Test void movingSlotWithHistoryIsRejected() {
        when(access.lock(AppointmentSlot.class,2L)).thenReturn(slot());
        when(appointments.existsByAppointmentSlot_Id(2L)).thenReturn(true);
        assertThrows(BusinessRuleViolationException.class, () -> service.update(2L,request(LocalTime.NOON,LocalTime.of(13,0))));
    }
}

