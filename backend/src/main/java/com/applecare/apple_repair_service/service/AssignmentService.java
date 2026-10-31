package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.AssignTechnicianRequest;
import com.applecare.apple_repair_service.dto.response.AssignmentResponse;
import com.applecare.apple_repair_service.entity.Assignment;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.AssignmentSource;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.event.MlPredictionEvent; // IMPORTS MỚI
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher; // IMPORTS MỚI
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AssignmentService {
    private final ServiceTicketRepository tickets;
    private final AssignmentRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final TechnicianEligibility eligibility;
    private final ServiceStatusService statuses;
    private final EntityResponses mapper;
    private final Clock clock;
    private final ApplicationEventPublisher eventPublisher; // TIÊM EVENT PUBLISHER

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public AssignmentResponse assignTechnician(Long ticketId, AssignTechnicianRequest r) {
        rules.validate(r);
        var ticket = tickets.findByIdForUpdate(ticketId).orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
        if (repository.findFirstByServiceTicket_IdAndStatus(ticketId, AssignmentStatus.ACTIVE).isPresent())
            throw new ConflictException("Ticket already has an ACTIVE assignment");
        BusinessRules.require(ticket.getStatus() == ServiceTicketStatus.WAITING_ASSIGNMENT, "Ticket must be WAITING_ASSIGNMENT");
        BusinessRules.require(r.source() != AssignmentSource.TRANSFER, "TRANSFER source is reserved for transfer workflow");
        access.lock(User.class, r.technicianId());
        var technician = eligibility.available(r.technicianId(), ticket.getBranch().getId());
        var actor = access.get(User.class, r.assignedByUserId());
        var assignment = new Assignment();
        assignment.setServiceTicket(ticket);
        assignment.setTechnician(technician);
        assignment.setAssignedBy(actor);
        assignment.setSource(r.source());
        assignment.setAssignedAt(LocalDateTime.now(clock));
        repository.saveAndFlush(assignment);
        statuses.changeStatus(ticket, ServiceTicketStatus.ASSIGNED, actor, "Technician assigned");

        // BẮN EVENT TỰ ĐỘNG KÍCH HOẠT ML SERVICE SAU KHIM COMMIT TRANSACTION
        eventPublisher.publishEvent(new MlPredictionEvent(ticketId, r.assignedByUserId()));

        return mapper.map(assignment);
    }

    public List<AssignmentResponse> getHistory(Long ticketId) {
        access.get(ServiceTicket.class, ticketId);
        return repository.findAllByServiceTicket_IdOrderByAssignedAtAsc(ticketId).stream().map(mapper::map).toList();
    }
}