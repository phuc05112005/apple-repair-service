package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.AssignTechnicianRequest;
import com.applecare.apple_repair_service.dto.response.AssignmentResponse;
import com.applecare.apple_repair_service.enums.PredictionSource;
import java.time.Clock;
import java.time.OffsetDateTime;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AssignmentOrchestrationService {
    private final AssignmentPredictionPreparationService preparation;
    private final AssignmentService assignments;
    private final MlAssignmentRefinementService refinement;
    private final Clock clock;

    public AssignmentResponse assign(Long ticketId, AssignTechnicianRequest request) {
        var evaluationTimestamp = OffsetDateTime.ofInstant(clock.instant(), clock.getZone());
        var estimate = preparation.prepare(ticketId, request.technicianId(), evaluationTimestamp);
        var assigned = assignments.assignTechnician(ticketId, request);
        if (estimate.source() == PredictionSource.ML) {
            try {
                refinement.refine(ticketId, request.technicianId(), request.assignedByUserId(), estimate);
            } catch (RuntimeException exception) {
                log.warn("Assignment succeeded but ML audit/ETA refinement failed ticketId={} technicianId={} errorType={}",
                        ticketId, request.technicianId(), exception.getClass().getSimpleName());
            }
        }
        return assigned;
    }
}
