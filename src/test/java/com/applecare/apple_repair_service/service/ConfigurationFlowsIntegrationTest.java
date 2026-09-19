package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class ConfigurationFlowsIntegrationTest {
    @Autowired EntityManager em;
    @Autowired Clock clock;
    @Autowired UserService users;
    @Autowired TechnicianScheduleService shifts;
    @Autowired TechnicianEligibility technicians;
    @Autowired ServiceIssueService issues;
    @Autowired DeviceTypeService deviceTypes;
    @Autowired PublicQueryService publicQueries;
    @Autowired AppointmentScheduleService schedule;
    @Autowired AppointmentSlotService slots;
    ApiFixture fixture;

    @BeforeEach void setup() { fixture = new ApiFixture(em, clock); fixture.create(); }

    @Test void createsBothOperationalRolesWithSelectedStatusAndKeepsAssignmentTechnicianOnly() {
        var receptionist = users.create(new CreateUserRequest(fixture.prefix + "frontdesk", ApiFixture.PASSWORD,
                "Front desk", null, UserRole.RECEPTIONIST, UserStatus.ACTIVE));
        var technician = users.create(new CreateUserRequest(fixture.prefix + "repairer", ApiFixture.PASSWORD,
                "Repairer", null, UserRole.TECHNICIAN, UserStatus.INACTIVE));
        assertEquals(UserStatus.INACTIVE, technician.status());
        assertEquals(UserRole.RECEPTIONIST, users.getById(receptionist.id()).role());
        assertEquals(UserRole.TECHNICIAN, users.getById(technician.id()).role());
        var date = LocalDate.now(clock).plusDays(2);
        var receptionShift = shifts.create(new CreateTechnicianScheduleRequest(receptionist.id(), fixture.branch.getId(),
                date, LocalTime.of(8, 0), LocalTime.NOON, TechnicianScheduleStatus.WORKING));
        assertEquals(1, shifts.listByTechnicianAndDate(receptionist.id(), date).size());
        shifts.update(receptionShift.id(), new UpdateTechnicianScheduleRequest(receptionist.id(), fixture.branch.getId(),
                date, LocalTime.of(8, 0), LocalTime.NOON, TechnicianScheduleStatus.OFF));
        assertEquals(TechnicianScheduleStatus.OFF, shifts.listByTechnicianAndDate(receptionist.id(), date).getFirst().status());
        assertThrows(Exception.class, () -> technicians.technician(receptionist.id()));
        var techShift = shifts.create(new CreateTechnicianScheduleRequest(fixture.technician.getId(), fixture.branch.getId(),
                date, LocalTime.of(8, 0), LocalTime.NOON, TechnicianScheduleStatus.WORKING));
        assertEquals(fixture.technician.getId(), techShift.technicianId());
    }

    @Test void issueMappingsFilterByDeviceTypeAndPreserveExistingCatalog() {
        var airpods = new DeviceType(); airpods.setName(fixture.prefix + " AirPods"); em.persist(airpods); em.flush();
        var camera = issues.create(new CreateServiceIssueRequest(fixture.prefix + " Camera", Set.of(fixture.deviceType.getId())));
        var battery = issues.create(new CreateServiceIssueRequest(fixture.prefix + " Pin", Set.of(fixture.deviceType.getId(), airpods.getId())));
        assertTrue(publicQueries.serviceIssues(airpods.getId()).stream().anyMatch(item -> item.id().equals(battery.id())));
        assertFalse(publicQueries.serviceIssues(airpods.getId()).stream().anyMatch(item -> item.id().equals(camera.id())));
        assertTrue(publicQueries.serviceIssues(fixture.deviceType.getId()).stream().anyMatch(item -> item.id().equals(camera.id())));
        assertEquals(1, publicQueries.catalog(fixture.model.getId(), fixture.issue.getId(), null).size());
        assertThrows(Exception.class, () -> issues.update(fixture.issue.getId(),
                new UpdateServiceIssueRequest(fixture.issue.getName(), Set.of(airpods.getId()))));
    }

    @Test void removingUnusedDeviceTypeAlsoRemovesOnlyItsIssueLinks() {
        var spare = new DeviceType(); spare.setName(fixture.prefix + " spare"); em.persist(spare); em.flush();
        var issue = issues.create(new CreateServiceIssueRequest(fixture.prefix + " spare issue", Set.of(spare.getId())));
        deviceTypes.delete(spare.getId());
        assertTrue(issues.getById(issue.id()).deviceTypeIds().isEmpty());
        assertNull(em.find(DeviceType.class, spare.getId()));
    }

    @Test void weeklyScheduleAndSingleDateOverrideRetainBookingsAndLeaveOtherWeeksIntact() {
        var date = LocalDate.now(clock).plusDays(8);
        var otherDate = date.plusWeeks(1);
        var rule = new SlotRule(LocalTime.of(9, 0), LocalTime.of(10, 0), true);
        schedule.saveWeekdays(List.of(
                new SaveWeeklyScheduleRequest(fixture.branch.getId(), date.getDayOfWeek().getValue(), true, List.of(rule)),
                new SaveWeeklyScheduleRequest(fixture.branch.getId(), date.plusDays(1).getDayOfWeek().getValue(), true, List.of(rule))));
        assertEquals(1, schedule.week(fixture.branch.getId()).get(date.plusDays(1).getDayOfWeek().getValue() - 1).slots().size());
        schedule.materialize(fixture.branch.getId(), date);
        var available = slots.availability(fixture.branch.getId(), date);
        assertEquals(1, available.size());
        var customer = new Customer(); customer.setFullName(fixture.prefix); customer.setPhone(fixture.prefix); em.persist(customer);
        var booking = new Appointment(); booking.setCustomer(customer);
        booking.setAppointmentSlot(em.find(AppointmentSlot.class, available.getFirst().slotId()));
        booking.setBookedAt(LocalDateTime.now(clock)); em.persist(booking); em.flush();
        assertEquals(1, slots.availability(fixture.branch.getId(), date).getFirst().activeBookingCount());
        schedule.saveOverride(new SaveDateOverrideRequest(fixture.branch.getId(), date, "REPLACE",
                List.of(new SlotRule(rule.startTime(), rule.endTime(), false),
                        new SlotRule(LocalTime.of(11, 0), LocalTime.NOON, true))));
        assertEquals(1, slots.availability(fixture.branch.getId(), date).size());
        assertEquals(LocalTime.of(11, 0), slots.availability(fixture.branch.getId(), date).getFirst().startTime());
        assertEquals(1, slots.list(fixture.branch.getId(), date).stream()
                .filter(item -> item.slotId().equals(available.getFirst().slotId())).findFirst().orElseThrow().activeBookingCount());
        schedule.materialize(fixture.branch.getId(), otherDate);
        assertEquals(LocalTime.of(9, 0), slots.availability(fixture.branch.getId(), otherDate).getFirst().startTime());
        assertEquals(1, schedule.week(fixture.branch.getId()).get(date.getDayOfWeek().getValue() - 1).slots().size());
    }
}
