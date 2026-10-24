package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateTransferRequest;
import com.applecare.apple_repair_service.dto.request.TransferDecisionRequest;
import com.applecare.apple_repair_service.dto.response.TransferResponse;
import com.applecare.apple_repair_service.entity.Assignment;
import com.applecare.apple_repair_service.entity.Transfer;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.AssignmentSource;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.enums.TransferMode;
import com.applecare.apple_repair_service.enums.TransferStatus;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;
import com.applecare.apple_repair_service.repository.TransferRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TransferService {
    private final TransferRepository transfers;
    private final AssignmentRepository assignments;
    private final ServiceTicketRepository tickets;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final TechnicianEligibility eligibility;
    private final EntityResponses mapper;
    private final Clock clock;
    private final ServiceTimingService timing;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TransferResponse requestTransfer(CreateTransferRequest r) {
        rules.validate(r);
        BusinessRules.require(r.mode() == TransferMode.REQUEST, "Use directTransfer for DIRECT mode");
        var old = lockAssignment(r.fromAssignmentId());
        validateTarget(old, r.targetTechnicianId());
        boolean duplicate = transfers.findAllByFromAssignment_ServiceTicket_IdOrderByRequestedAtDesc(old.getServiceTicket().getId()).stream()
                .anyMatch(t -> t.getStatus() == TransferStatus.PENDING && t.getFromAssignment().getId().equals(old.getId()) && t.getTargetTechnician().getId().equals(r.targetTechnicianId()));
        if (duplicate) throw new ConflictException("Equivalent pending transfer already exists");
        return mapper.map(transfers.saveAndFlush(create(old, r)));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TransferResponse directTransfer(CreateTransferRequest r) {
        rules.validate(r);
        BusinessRules.require(r.mode() == TransferMode.DIRECT, "DIRECT mode required");
        var old = lockAssignment(r.fromAssignmentId());
        validateTarget(old, r.targetTechnicianId());
        var transfer = create(old, r);
        complete(transfer, access.get(User.class, r.requestedByUserId()), null);
        return mapper.map(transfers.saveAndFlush(transfer));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TransferResponse acceptTransfer(Long id, TransferDecisionRequest r) {
        rules.validate(r);
        var t = lockTransfer(id);
        pending(t);
        validateTarget(t.getFromAssignment(), t.getTargetTechnician().getId());
        complete(t, access.get(User.class, r.respondedByUserId()), r.note());
        return mapper.map(t);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TransferResponse rejectTransfer(Long id, TransferDecisionRequest r) {
        return decide(id, r, TransferStatus.REJECTED);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TransferResponse cancelTransfer(Long id, TransferDecisionRequest r) {
        return decide(id, r, TransferStatus.CANCELLED);
    }

    public List<TransferResponse> getHistory(Long ticketId) {
        return transfers.findAllByFromAssignment_ServiceTicket_IdOrderByRequestedAtDesc(ticketId).stream().map(mapper::map).toList();
    }

    private TransferResponse decide(Long id, TransferDecisionRequest r, TransferStatus next) {
        rules.validate(r);
        var t = lockTransfer(id);
        pending(t);
        t.setStatus(next);
        t.setRespondedBy(access.get(User.class, r.respondedByUserId()));
        t.setRespondedAt(LocalDateTime.now(clock));
        if (BusinessRules.text(r.note()) != null) t.setResponseNote(r.note().trim());
        return mapper.map(t);
    }

    private Assignment lockAssignment(Long id) {
        var initial = access.get(Assignment.class, id);
        tickets.findByIdForUpdate(initial.getServiceTicket().getId()).orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
        var old = access.lock(Assignment.class, id);
        BusinessRules.require(old.getStatus() == AssignmentStatus.ACTIVE, "Assignment is no longer ACTIVE");
        return old;
    }

    private Transfer lockTransfer(Long id) {
        var initial = access.get(Transfer.class, id);
        var old = initial.getFromAssignment();
        tickets.findByIdForUpdate(old.getServiceTicket().getId()).orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
        access.lock(Assignment.class, old.getId());
        return access.lock(Transfer.class, id);
    }

    private void pending(Transfer t) {
        BusinessRules.require(t.getMode() == TransferMode.REQUEST && t.getStatus() == TransferStatus.PENDING, "Transfer is not pending REQUEST");
    }

    private void validateTarget(Assignment old, Long target) {
        BusinessRules.require(old.getStatus() == AssignmentStatus.ACTIVE, "Assignment is no longer ACTIVE");
        BusinessRules.require(!old.getTechnician().getId().equals(target), "Target must be a different technician");
        access.lock(User.class, target);
        eligibility.available(target, old.getServiceTicket().getBranch().getId());
    }

    private Transfer create(Assignment old, CreateTransferRequest r) {
        var t = new Transfer();
        t.setFromAssignment(old);
        t.setTargetTechnician(access.get(User.class, r.targetTechnicianId()));
        t.setRequestedBy(access.get(User.class, r.requestedByUserId()));
        t.setMode(r.mode());
        t.setRequestedAt(LocalDateTime.now(clock));
        t.setNote(BusinessRules.text(r.note()));
        t.setWorkDone(BusinessRules.required(r.workDone(), "Work completed is required"));
        t.setCurrentCondition(BusinessRules.required(r.currentCondition(), "Current device condition is required"));
        return t;
    }

    private void complete(Transfer t, User actor, String note) {
        var old = t.getFromAssignment();
        old.setStatus(AssignmentStatus.ENDED);
        old.setEndedAt(LocalDateTime.now(clock));
        var next = new Assignment();
        next.setServiceTicket(old.getServiceTicket());
        next.setTechnician(t.getTargetTechnician());
        next.setAssignedBy(actor);
        next.setSource(AssignmentSource.TRANSFER);
        next.setAssignedAt(LocalDateTime.now(clock));
        assignments.save(next);
        timing.transferred(old.getServiceTicket(), actor);
        t.setStatus(TransferStatus.ACCEPTED);
        t.setRespondedBy(actor);
        t.setRespondedAt(LocalDateTime.now(clock));
        if (BusinessRules.text(note) != null) t.setResponseNote(note.trim());
    }
}
