package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.ServiceTicket;
import java.time.OffsetDateTime;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AssignmentPredictionPreparationService {
    private final DomainAccess access;
    private final TechnicianEligibility eligibility;
    private final MlCandidateEstimateService estimates;

    public MlCandidateEstimateService.TechnicalEstimate prepare(Long ticketId, Long technicianId,
                                                                 OffsetDateTime evaluationTimestamp) {
        var ticket = access.get(ServiceTicket.class, ticketId);
        eligibility.available(technicianId, ticket.getBranch().getId());
        return estimates.estimate(ticket, java.util.List.of(technicianId), evaluationTimestamp).get(technicianId);
    }
}
