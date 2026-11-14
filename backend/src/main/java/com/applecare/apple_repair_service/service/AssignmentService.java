package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.AssignTechnicianRequest;
import com.applecare.apple_repair_service.dto.response.AssignmentResponse;
import com.applecare.apple_repair_service.entity.Assignment;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.AssignmentSource;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.enums.EstimateSource;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.repository.RepairItemRepository;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AssignmentService {
    private final ServiceTicketRepository tickets;
    private final AssignmentRepository repository;
    private final RepairItemRepository repairItems;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final TechnicianEligibility eligibility;
    private final ServiceStatusService statuses;
    private final EntityResponses mapper;
    private final Clock clock;
    private final ApplicationEventPublisher eventPublisher;
    private final MlCandidateEstimateService mlCandidateEstimateService;

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

        var now = LocalDateTime.now(clock);
        var assignment = new Assignment();
        assignment.setServiceTicket(ticket);
        assignment.setTechnician(technician);
        assignment.setAssignedBy(actor);
        assignment.setSource(r.source());
        assignment.setAssignedAt(now);
        repository.saveAndFlush(assignment);

        long duration = (r.predictedDurationMinutes() != null && r.predictedDurationMinutes() > 0)
                ? r.predictedDurationMinutes()
                : (long) mlCandidateEstimateService.standardDuration(ticketId);

        ticket.setEstimatedDurationMinutes(duration);

        if (r.predictedDurationMinutes() != null && r.predictedDurationMinutes() == mlCandidateEstimateService.standardDuration(ticketId)) {
            ticket.setEstimateSource(EstimateSource.STANDARD);
        } else {
            ticket.setEstimateSource(EstimateSource.ML);
        }

        allocateInitialItemDurations(ticketId, duration);

        tickets.save(ticket);

        statuses.changeStatus(ticket, ServiceTicketStatus.ASSIGNED, actor, "Technician assigned");

        return mapper.map(assignment);
    }

    private void allocateInitialItemDurations(Long ticketId, long totalDuration) {
        var approved = repairItems.findAllByServiceTicket_Id(ticketId).stream()
                .filter(i -> i.getApprovalStatus() == ApprovalStatus.APPROVED)
                .toList();
        if (approved.isEmpty()) return;
        if (approved.size() == 1) {
            approved.get(0).setEstimatedDurationMinutes(totalDuration);
            repairItems.save(approved.get(0));
            return;
        }
        long totalStd = approved.stream()
                .mapToLong(this::itemStandardMinutes)
                .sum();
        long allocated = 0;
        for (int i = 0; i < approved.size(); i++) {
            RepairItem item = approved.get(i);
            long share = (i == approved.size() - 1)
                    ? Math.max(1L, totalDuration - allocated)
                    : (totalStd > 0
                    ? Math.max(1L, Math.round((double) totalDuration * itemStandardMinutes(item) / totalStd))
                    : Math.max(1L, totalDuration / approved.size()));
            item.setEstimatedDurationMinutes(share);
            allocated += share;
        }
        repairItems.saveAll(approved);
    }

    private long itemStandardMinutes(RepairItem item) {
        var cat = item.getWarrantyReplacementCatalog() != null
                ? item.getWarrantyReplacementCatalog()
                : item.getServiceCatalogItem();
        return (cat != null && cat.getStandardDurationMinutes() != null && cat.getStandardDurationMinutes() > 0)
                ? cat.getStandardDurationMinutes()
                : 30L;
    }

    public List<AssignmentResponse> getHistory(Long ticketId) {
        access.get(ServiceTicket.class, ticketId);
        return repository.findAllByServiceTicket_IdOrderByAssignedAtAsc(ticketId).stream().map(mapper::map).toList();
    }
}