package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.AssignTechnicianRequest;
import com.applecare.apple_repair_service.dto.request.CreateTechnicianScheduleRequest;
import com.applecare.apple_repair_service.dto.request.CreateTransferRequest;
import com.applecare.apple_repair_service.dto.request.TransferDecisionRequest;
import com.applecare.apple_repair_service.entity.Assignment;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.MlPrediction;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.TechnicianSchedule;
import com.applecare.apple_repair_service.entity.Transfer;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.AssignmentSource;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.enums.PredictionType;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.TechnicianScheduleStatus;
import com.applecare.apple_repair_service.enums.TransferMode;
import com.applecare.apple_repair_service.enums.TransferStatus;
import com.applecare.apple_repair_service.enums.UserRole;
import com.applecare.apple_repair_service.enums.UserStatus;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.repository.MlPredictionRepository;
import com.applecare.apple_repair_service.repository.RepairItemRepository;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;
import com.applecare.apple_repair_service.repository.TechnicianScheduleRepository;
import com.applecare.apple_repair_service.repository.TransferRepository;
import jakarta.validation.Validation;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TechnicianServiceTest {
    final DomainAccess access = mock(DomainAccess.class);
    final TechnicianScheduleRepository schedules = mock(TechnicianScheduleRepository.class);
    final AssignmentRepository assignments = mock(AssignmentRepository.class);
    final ServiceTicketRepository tickets = mock(ServiceTicketRepository.class);
    final ServiceStatusService statuses = mock(ServiceStatusService.class);
    final User tech = TestData.user(2);
    final TechnicianEligibility eligibility = new TechnicianEligibility(access, schedules, TestData.CLOCK);
    final BusinessRules rules = new BusinessRules(Validation.buildDefaultValidatorFactory().getValidator());
    final AssignmentService service = new AssignmentService(tickets, assignments, access, rules, eligibility, statuses, new EntityResponses(), TestData.CLOCK);
    final ServiceTicket ticket = TestData.ticket(ServiceTicketStatus.WAITING_ASSIGNMENT);

    TechnicianSchedule shift(User user) {
        var s = new TechnicianSchedule();
        s.setTechnician(user);
        s.setBranch(ticket.getBranch());
        s.setWorkDate(LocalDate.now(TestData.CLOCK));
        s.setStartTime(LocalTime.of(8, 0));
        s.setEndTime(LocalTime.of(12, 0));
        return s;
    }

    @BeforeEach
    void setup() {
        when(tickets.findByIdForUpdate(1L)).thenReturn(Optional.of(ticket));
        when(access.get(User.class, 2L)).thenReturn(tech);
        when(access.get(User.class, 1L)).thenReturn(TestData.user(1));
        when(schedules.findAllByTechnician_IdAndWorkDate(2L, LocalDate.now(TestData.CLOCK))).thenReturn(List.of(shift(tech)));
        when(assignments.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
    }

    AssignTechnicianRequest request() {
        return new AssignTechnicianRequest(2L, 1L, AssignmentSource.MANUAL_OVERRIDE);
    }

    @Test
    void rejectsWrongRole() {
        tech.setRole(UserRole.RECEPTIONIST);
        assertThrows(BusinessRuleViolationException.class, () -> service.assignTechnician(1L, request()));
    }

    @Test
    void rejectsInactive() {
        tech.setStatus(UserStatus.INACTIVE);
        assertThrows(BusinessRuleViolationException.class, () -> service.assignTechnician(1L, request()));
    }

    @Test
    void rejectsMissingShift() {
        when(schedules.findAllByTechnician_IdAndWorkDate(any(), any())).thenReturn(List.of());
        assertThrows(BusinessRuleViolationException.class, () -> service.assignTechnician(1L, request()));
    }

    @Test
    void rejectsDuplicateAssignment() {
        when(assignments.findFirstByServiceTicket_IdAndStatus(1L, AssignmentStatus.ACTIVE)).thenReturn(Optional.of(new Assignment()));
        assertThrows(ConflictException.class, () -> service.assignTechnician(1L, request()));
    }

    @Test
    void assignmentLocksBeforeCheckingAndTransitions() {
        var result = service.assignTechnician(1L, request());
        assertEquals(AssignmentStatus.ACTIVE, result.status());
        assertNotNull(result.assignedAt());
        var order = inOrder(tickets, assignments);
        order.verify(tickets).findByIdForUpdate(1L);
        order.verify(assignments).findFirstByServiceTicket_IdAndStatus(1L, AssignmentStatus.ACTIVE);
        verify(statuses).changeStatus(eq(ticket), eq(ServiceTicketStatus.ASSIGNED), any(), any());
    }

    @Test
    void recommendationUsesMinutesAndLatestPrediction() {
        var predictions = mock(MlPredictionRepository.class);
        var repairs = mock(RepairItemRepository.class);
        var second = TestData.user(3);
        when(access.get(ServiceTicket.class, 1L)).thenReturn(ticket);
        when(schedules.findAllByBranch_IdAndWorkDateAndStatus(any(), any(), any())).thenReturn(List.of(shift(tech), shift(second)));
        var ml = new MlPrediction();
        ml.setPredictedDurationMinutes(90);
        when(predictions.findFirstByServiceTicket_IdAndPredictionTypeOrderByPredictedAtDescIdDesc(10L, PredictionType.REPAIR_DURATION)).thenReturn(Optional.of(ml));
        var a = new Assignment();
        var old = TestData.ticket(ServiceTicketStatus.REPAIRING);
        old.setId(10L);
        a.setServiceTicket(old);
        when(assignments.findAllByTechnician_IdAndStatus(2L, AssignmentStatus.ACTIVE)).thenReturn(List.of(a));
        when(repairs.findAllByServiceTicket_Id(1L)).thenReturn(List.of(TestData.item(1, ticket, ApprovalStatus.APPROVED), TestData.item(2, ticket, ApprovalStatus.APPROVED)));
        var recommendations = new TechnicianRecommendationService(schedules, assignments, predictions, repairs, access, TestData.CLOCK);
        var result = recommendations.recommend(1L);
        assertEquals(3L, result.getFirst().technicianId());
        assertTrue(result.getFirst().eligible());
        assertFalse(result.getLast().eligible());
        assertEquals(90, result.getLast().estimatedWorkloadMinutes());
        assertEquals(60, result.getFirst().predictedNewJobMinutes());
        assertEquals(60, recommendations.estimate(99L));
    }

    @Test
    void adjacentSchedulesAllowedButOverlapRejected() {
        var old = shift(tech);
        old.setId(5L);
        old.setEndTime(LocalTime.of(10, 0));
        when(schedules.findAllByTechnician_IdAndWorkDate(any(), any())).thenReturn(List.of(old));
        when(access.get(Branch.class, 1L)).thenReturn(ticket.getBranch());
        when(schedules.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        var service = new TechnicianScheduleService(schedules, access, rules, new EntityResponses());
        assertNotNull(service.create(new CreateTechnicianScheduleRequest(2L, 1L, LocalDate.now(TestData.CLOCK), LocalTime.of(10, 0), LocalTime.NOON, TechnicianScheduleStatus.WORKING)));
        assertThrows(BusinessRuleViolationException.class, () -> service.create(new CreateTechnicianScheduleRequest(2L, 1L, LocalDate.now(TestData.CLOCK), LocalTime.of(9, 59), LocalTime.NOON, TechnicianScheduleStatus.WORKING)));
    }

    @Test
    void requestAcceptTransferEndsOldAndKeepsTicketState() {
        transfer(true, false);
    }

    @Test
    void rejectTransferKeepsOldActive() {
        transfer(false, false);
    }

    @Test
    void directTransferEndsOldAtomically() {
        transfer(true, true);
    }

    void transfer(boolean accept, boolean direct) {
        var repo = mock(TransferRepository.class);
        var old = new Assignment();
        old.setId(5L);
        old.setServiceTicket(ticket);
        old.setTechnician(TestData.user(1));
        when(access.get(Assignment.class, 5L)).thenReturn(old);
        when(access.lock(Assignment.class, 5L)).thenReturn(old);
        when(repo.saveAndFlush(any())).thenAnswer(i -> {
            Transfer t = i.getArgument(0);
            t.setId(9L);
            when(access.get(Transfer.class, 9L)).thenReturn(t);
            when(access.lock(Transfer.class, 9L)).thenReturn(t);
            return t;
        });
        var service = new TransferService(repo, assignments, tickets, access, rules, eligibility, new EntityResponses(), TestData.CLOCK);
        var request = new CreateTransferRequest(5L, 2L, 1L, direct ? TransferMode.DIRECT : TransferMode.REQUEST, null);
        var result = direct ? service.directTransfer(request) : service.requestTransfer(request);
        if (!direct) {
            assertEquals(TransferStatus.PENDING, result.status());
            result = accept ? service.acceptTransfer(9L, new TransferDecisionRequest(1L, null)) : service.rejectTransfer(9L, new TransferDecisionRequest(1L, null));
        }
        assertEquals(accept ? AssignmentStatus.ENDED : AssignmentStatus.ACTIVE, old.getStatus());
        assertEquals(accept ? TransferStatus.ACCEPTED : TransferStatus.REJECTED, result.status());
        assertEquals(ServiceTicketStatus.WAITING_ASSIGNMENT, ticket.getStatus());
        if (accept)
            verify(assignments).save(argThat(a -> a.getStatus() == AssignmentStatus.ACTIVE && a.getSource() == AssignmentSource.TRANSFER));
    }
}
