package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;
import java.time.LocalDateTime;
import java.time.ZoneId;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MlAssignmentRefinementService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final ServiceTicketRepository tickets;
    private final AssignmentRepository assignments;
    private final DomainAccess access;
    private final MlPredictionService predictions;
    private final ServiceTimingService timing;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void refine(Long ticketId, Long technicianId, Long actorId,
                       MlCandidateEstimateService.TechnicalEstimate estimate) {
        var ticket = tickets.findByIdForUpdate(ticketId)
                .orElseThrow(() -> new com.applecare.apple_repair_service.exception.ResourceNotFoundException("Ticket not found"));
        var assignment = assignments.findFirstByServiceTicket_IdAndStatus(ticketId, AssignmentStatus.ACTIVE)
                .orElseThrow(() -> new com.applecare.apple_repair_service.exception.ConflictException("Active assignment not found"));
        BusinessRules.require(assignment.getTechnician().getId().equals(technicianId),
                "Prediction technician does not match active assignment");
        var predictedAt = estimate.evaluationTimestamp() == null ? LocalDateTime.now(BUSINESS_ZONE)
                : estimate.evaluationTimestamp().atZoneSameInstant(BUSINESS_ZONE).toLocalDateTime();
        predictions.saveDurationAudit(ticketId, technicianId, Math.toIntExact(estimate.durationMinutes()),
                estimate.modelName(), estimate.modelVersion(), predictedAt);
        timing.assignmentPrediction(ticket, assignment.getTechnician(), estimate.durationMinutes(),
                access.get(User.class, actorId));
    }
}
