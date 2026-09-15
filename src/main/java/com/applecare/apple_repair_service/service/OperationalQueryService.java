package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.response.AvailablePartResponse;
import com.applecare.apple_repair_service.dto.response.IncomingTransferResponse;
import com.applecare.apple_repair_service.dto.response.OperationalTicketResponse;
import com.applecare.apple_repair_service.dto.response.PartUsageResponse;
import com.applecare.apple_repair_service.dto.response.TechnicianRecommendationResponse;
import com.applecare.apple_repair_service.entity.Assignment;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.enums.TransferStatus;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.repository.BranchInventoryRepository;
import com.applecare.apple_repair_service.repository.PartUsageRepository;
import com.applecare.apple_repair_service.repository.RepairItemRepository;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;
import com.applecare.apple_repair_service.repository.TransferRepository;
import com.applecare.apple_repair_service.security.CurrentActor;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OperationalQueryService {
    private final ServiceTicketRepository tickets;
    private final AssignmentRepository assignments;
    private final TransferRepository transfers;
    private final RepairItemRepository repairItems;
    private final BranchInventoryRepository inventories;
    private final PartUsageRepository partUsages;
    private final TicketAccessPolicy policy;
    private final TechnicianRecommendationService recommendations;
    private final CurrentActor actor;
    private final EntityResponses mapper;

    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public List<OperationalTicketResponse> queue(Long branchId, ServiceTicketStatus status, String query) {
        return tickets.findOperationalTickets(branchId, status, BusinessRules.text(query)).stream()
                .map(ticket -> operational(ticket, active(ticket.getId())))
                .toList();
    }

    @PreAuthorize("hasRole('TECHNICIAN')")
    public List<OperationalTicketResponse> myWork(ServiceTicketStatus status) {
        return assignments.findAllByTechnician_IdAndStatusOrderByAssignedAtAsc(actor.id(), AssignmentStatus.ACTIVE).stream()
                .filter(assignment -> status == null || assignment.getServiceTicket().getStatus() == status)
                .map(assignment -> operational(assignment.getServiceTicket(), assignment))
                .toList();
    }

    @PreAuthorize("hasRole('TECHNICIAN')")
    public List<IncomingTransferResponse> incomingTransfers() {
        return transfers.findAllByTargetTechnician_IdAndStatusOrderByRequestedAtDesc(actor.id(), TransferStatus.PENDING).stream()
                .map(transfer -> new IncomingTransferResponse(mapper.map(transfer),
                        operational(transfer.getFromAssignment().getServiceTicket(), transfer.getFromAssignment())))
                .toList();
    }

    @PreAuthorize("hasRole('TECHNICIAN')")
    public List<TechnicianRecommendationResponse> transferCandidates(Long ticketId) {
        var current = policy.requireActiveTechnicianRead(ticketId);
        return recommendations.recommend(ticketId).stream()
                .filter(candidate -> !candidate.technicianId().equals(current.getTechnician().getId()))
                .toList();
    }

    @PreAuthorize("hasRole('TECHNICIAN')")
    public List<AvailablePartResponse> availableParts(Long ticketId, String query) {
        policy.requireActiveTechnicianRead(ticketId);
        var ticket = tickets.findById(ticketId).orElseThrow();
        return inventories.findAvailableParts(ticket.getBranch().getId(), ActiveStatus.ACTIVE, BusinessRules.text(query)).stream()
                .map(inventory -> new AvailablePartResponse(inventory.getPart().getId(), inventory.getPart().getPartCode(),
                        inventory.getPart().getName(), inventory.getPart().getBrand(), inventory.getPart().getVariant(),
                        inventory.getPart().getSalePrice(), inventory.getBranch().getId(), inventory.getQuantity()))
                .toList();
    }

    @PreAuthorize("hasRole('TECHNICIAN')")
    public List<PartUsageResponse> partUsages(Long repairItemId) {
        policy.requireItemRead(repairItemId);
        return partUsages.findAllByRepairItem_Id(repairItemId).stream().map(mapper::map).toList();
    }

    private Assignment active(Long ticketId) {
        return assignments.findFirstByServiceTicket_IdAndStatus(ticketId, AssignmentStatus.ACTIVE).orElse(null);
    }

    private OperationalTicketResponse operational(ServiceTicket ticket, Assignment assignment) {
        var device = ticket.getCustomerDevice();
        var customer = device.getCustomer();
        var items = repairItems.findAllByServiceTicket_Id(ticket.getId());
        var issueNames = items.stream().map(item -> item.getServiceCatalogItem().getServiceIssue().getName()).distinct().toList();
        var serviceNames = items.stream().map(item -> item.getItemNameSnapshot()).distinct().toList();
        return new OperationalTicketResponse(ticket.getId(), ticket.getTicketCode(), customer.getFullName(), customer.getPhone(),
                device.getId(), device.getDeviceModel().getId(), device.getDeviceModel().getName(), issueNames, serviceNames,
                ticket.getBranch().getId(), ticket.getBranch().getName(), ticket.getStatus(), ticket.getReceivedAt(),
                recommendations.estimate(ticket.getId()), assignment == null ? null : assignment.getId(),
                assignment == null ? null : assignment.getTechnician().getId(),
                assignment == null ? null : assignment.getTechnician().getFullName());
    }
}
