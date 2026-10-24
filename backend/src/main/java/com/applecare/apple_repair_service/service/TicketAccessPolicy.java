package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.*;
import com.applecare.apple_repair_service.enums.*;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.security.CurrentActor;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Transactional(propagation=Propagation.MANDATORY)
public class TicketAccessPolicy {
    private final DomainAccess access;
    private final AssignmentRepository assignments;
    private final CurrentActor actor;

    public Assignment requireActiveTechnician(Long ticketId) {
        if (actor.principal().role()!=UserRole.TECHNICIAN) denied();
        var assignment=activeAssignment(ticketId);
        if (!assignment.getTechnician().getId().equals(actor.id())) denied();
        return assignment;
    }
    public Assignment requireActiveTechnicianRead(Long ticketId) {
        if (actor.principal().role()!=UserRole.TECHNICIAN) denied();
        access.get(ServiceTicket.class,ticketId);
        var assignment=assignments.findFirstByServiceTicket_IdAndStatus(ticketId,AssignmentStatus.ACTIVE)
                .orElseThrow(() -> new AccessDeniedException("An active assignment is required"));
        if (!assignment.getTechnician().getId().equals(actor.id())) denied();
        return assignment;
    }
    public Assignment activeAssignment(Long ticketId) {
        access.lock(ServiceTicket.class,ticketId);
        return assignments.findFirstByServiceTicket_IdAndStatus(ticketId,AssignmentStatus.ACTIVE)
                .orElseThrow(() -> new AccessDeniedException("An active assignment is required"));
    }
    public void requireRead(Long ticketId) {
        var role=actor.principal().role();
        if (role==UserRole.TECHNICIAN) requireActiveTechnicianRead(ticketId);
        else if (role==UserRole.ADMIN || role==UserRole.RECEPTIONIST) access.get(ServiceTicket.class,ticketId);
        else denied();
    }
    public Long requireItemRead(Long itemId) {
        var item=access.get(RepairItem.class,itemId);
        Long ticketId=item.getServiceTicket().getId();
        requireActiveTechnicianRead(ticketId);
        return ticketId;
    }
    public Long requireItem(Long itemId) {
        var item=access.get(RepairItem.class,itemId);
        Long ticketId=item.getServiceTicket().getId();
        requireActiveTechnician(ticketId);
        return ticketId;
    }
    public void requireUsage(Long usageId) {
        requireItem(access.get(PartUsage.class,usageId).getRepairItem().getId());
    }
    public void requireTransferTarget(Long transferId) {
        var transfer=lockTransfer(transferId);
        if (actor.principal().role()!=UserRole.TECHNICIAN || !transfer.getTargetTechnician().getId().equals(actor.id())) denied();
    }
    public void requireTransferCancellation(Long transferId) {
        var transfer=lockTransfer(transferId);
        var role=actor.principal().role();
        if (role!=UserRole.RECEPTIONIST && !(role==UserRole.TECHNICIAN && transfer.getRequestedBy().getId().equals(actor.id()))) denied();
    }
    private Transfer lockTransfer(Long transferId) {
        var initial=access.get(Transfer.class,transferId);
        var assignment=initial.getFromAssignment();
        access.lock(ServiceTicket.class,assignment.getServiceTicket().getId());
        access.lock(Assignment.class,assignment.getId());
        return access.lock(Transfer.class,transferId);
    }
    private static void denied() { throw new AccessDeniedException("You cannot access this service record"); }
}
