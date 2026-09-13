package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.command.*;
import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.security.CurrentActor;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@PreAuthorize("hasRole('TECHNICIAN')")
@Transactional(isolation=Isolation.READ_COMMITTED)
public class TechnicianOperationsService {
    private final TicketAccessPolicy policy;
    private final CurrentActor actor;
    private final ServiceTicketService tickets;
    private final InventoryService inventory;
    private final RepairDurationService durations;
    private final WarrantyService warranties;

    public ServiceTicketDetailResponse startInspection(Long id) {
        policy.requireActiveTechnician(id);
        return tickets.startInspection(id,actor.id());
    }
    public ServiceTicketDetailResponse inspect(Long id, InspectionCommand request) {
        policy.requireActiveTechnician(id);
        return tickets.recordInspection(id,new RecordInspectionRequest(request.inspectionResult(),actor.id(),
                request.requiresCustomerApproval(),request.items()));
    }
    public ServiceTicketDetailResponse waitForPart(Long id, NoteCommand request) {
        policy.requireActiveTechnician(id);
        return tickets.waitForPart(id,actor.id(),request.note());
    }
    public ServiceTicketDetailResponse resumeRepair(Long id) {
        policy.requireActiveTechnician(id);
        return tickets.resumeRepair(id,actor.id());
    }
    public ServiceTicketDetailResponse finishRepair(Long id) {
        policy.requireActiveTechnician(id);
        return tickets.finishRepair(id,actor.id());
    }
    public RepairDurationResponse duration(Long id) {
        policy.requireActiveTechnician(id);
        return new RepairDurationResponse(id,durations.calculateCompletedRepairMinutes(id),durations.calculateCurrentRepairMinutes(id));
    }
    public PartUsageResponse usePart(Long itemId, PartUsageCommand request) {
        policy.requireItem(itemId);
        return inventory.usePart(new UsePartRequest(itemId,request.partId(),request.quantity(),actor.id()));
    }
    public PartUsageResponse reverseUsage(Long usageId, NoteCommand request) {
        policy.requireUsage(usageId);
        return inventory.reversePartUsage(new ReversePartUsageRequest(usageId,actor.id(),request.note()));
    }
    public RepairItemResponse warranty(Long itemId, WarrantyDecisionRequest request) {
        policy.requireItem(itemId);
        return warranties.recordWarrantyDecision(itemId,request);
    }
}

