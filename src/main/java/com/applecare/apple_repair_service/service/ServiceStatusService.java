package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.ServiceStatusHistory;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.exception.InvalidStateTransitionException;
import com.applecare.apple_repair_service.repository.AssignmentRepository;
import com.applecare.apple_repair_service.repository.ServiceStatusHistoryRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Set;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class ServiceStatusService {
    private final ServiceStatusHistoryRepository histories;
    private final AssignmentRepository assignments;
    private final Clock clock;

    void initialize(ServiceTicket ticket, User actor) {
        BusinessRules.require(ticket.getStatus() == ServiceTicketStatus.WAITING_ASSIGNMENT, "Invalid initial ticket state");
        BusinessRules.require(histories.findAllByServiceTicket_IdOrderByChangedAtAsc(ticket.getId()).isEmpty(), "Ticket history already initialized");
        history(ticket, null, ServiceTicketStatus.WAITING_ASSIGNMENT, actor, "Tiếp nhận thiết bị");
    }

    void changeStatus(ServiceTicket ticket, ServiceTicketStatus next, User actor, String note) {
        var old = ticket.getStatus();
        boolean allowed = switch (old) {
            case WAITING_ASSIGNMENT -> next == ServiceTicketStatus.ASSIGNED || next == ServiceTicketStatus.CANCELLED;
            case ASSIGNED -> next == ServiceTicketStatus.INSPECTING || next == ServiceTicketStatus.CANCELLED;
            case INSPECTING ->
                    Set.of(ServiceTicketStatus.REPAIRING, ServiceTicketStatus.WAITING_APPROVAL, ServiceTicketStatus.CANCELLED).contains(next);
            case WAITING_APPROVAL ->
                    next == ServiceTicketStatus.REPAIRING || next == ServiceTicketStatus.WAITING_HANDOVER;
            case REPAIRING -> next == ServiceTicketStatus.WAITING_PART || next == ServiceTicketStatus.WAITING_HANDOVER;
            case WAITING_PART -> next == ServiceTicketStatus.REPAIRING;
            case WAITING_HANDOVER -> next == ServiceTicketStatus.HANDED_OVER;
            default -> false;
        };
        if (!allowed) throw new InvalidStateTransitionException(old + " -> " + next);
        ticket.setStatus(next);
        history(ticket, old, next, actor, note);
        if (next == ServiceTicketStatus.WAITING_HANDOVER || next == ServiceTicketStatus.CANCELLED) {
            assignments.findFirstByServiceTicket_IdAndStatus(ticket.getId(), AssignmentStatus.ACTIVE).ifPresent(a -> {
                a.setStatus(AssignmentStatus.ENDED);
                a.setEndedAt(LocalDateTime.now(clock));
            });
        }
    }

    private void history(ServiceTicket ticket, ServiceTicketStatus old, ServiceTicketStatus next, User actor, String note) {
        var h = new ServiceStatusHistory();
        h.setServiceTicket(ticket);
        h.setFromStatus(old);
        h.setToStatus(next);
        h.setChangedBy(actor);
        h.setNote(BusinessRules.text(note));
        h.setChangedAt(LocalDateTime.now(clock));
        histories.save(h);
    }
}
