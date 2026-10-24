package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.command.*;
import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.response.TransferResponse;
import com.applecare.apple_repair_service.enums.TransferMode;
import com.applecare.apple_repair_service.security.CurrentActor;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@RequiredArgsConstructor
@Transactional(isolation=Isolation.READ_COMMITTED)
public class TransferOperationsService {
    private final TicketAccessPolicy policy;
    private final CurrentActor actor;
    private final TransferService transfers;

    @PreAuthorize("hasRole('TECHNICIAN')")
    public TransferResponse request(Long ticketId, TransferCommand request) {
        var active=policy.requireActiveTechnician(ticketId);
        return transfers.requestTransfer(new CreateTransferRequest(active.getId(), request.targetTechnicianId(), actor.id(), TransferMode.REQUEST,
                request.note(), request.workDone(), request.currentCondition()));
    }
    @PreAuthorize("hasRole('RECEPTIONIST')")
    public TransferResponse direct(Long ticketId, TransferCommand request) {
        var active=policy.activeAssignment(ticketId);
        return transfers.directTransfer(new CreateTransferRequest(active.getId(), request.targetTechnicianId(), actor.id(), TransferMode.DIRECT,
                request.note(), request.workDone(), request.currentCondition()));
    }
    @PreAuthorize("hasRole('TECHNICIAN')")
    public TransferResponse accept(Long transferId, NoteCommand request) {
        policy.requireTransferTarget(transferId);
        return transfers.acceptTransfer(transferId,new TransferDecisionRequest(actor.id(),request.note()));
    }
    @PreAuthorize("hasRole('TECHNICIAN')")
    public TransferResponse reject(Long transferId, NoteCommand request) {
        policy.requireTransferTarget(transferId);
        return transfers.rejectTransfer(transferId,new TransferDecisionRequest(actor.id(),request.note()));
    }
    @PreAuthorize("hasAnyRole('TECHNICIAN','RECEPTIONIST')")
    public TransferResponse cancel(Long transferId, NoteCommand request) {
        policy.requireTransferCancellation(transferId);
        return transfers.cancelTransfer(transferId,new TransferDecisionRequest(actor.id(),request.note()));
    }
}
