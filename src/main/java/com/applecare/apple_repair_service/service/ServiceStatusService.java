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
    private final ServiceTimingService timing;
    private final DomainAccess access;

    void planChanged(ServiceTicket ticket, User actor) { timing.planChanged(ticket, actor); }

    void initialize(ServiceTicket ticket, User actor) {
        BusinessRules.require(ticket.getStatus() == ServiceTicketStatus.WAITING_ASSIGNMENT, "Invalid initial ticket state");
        BusinessRules.require(histories.findAllByServiceTicket_IdOrderByChangedAtAsc(ticket.getId()).isEmpty(), "Ticket history already initialized");
        history(ticket, null, ServiceTicketStatus.WAITING_ASSIGNMENT, actor, "Tiếp nhận thiết bị");
        timing.created(ticket, actor);
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
            case REPAIRING -> next == ServiceTicketStatus.WAITING_PART || next == ServiceTicketStatus.WAITING_HANDOVER || next == ServiceTicketStatus.WAITING_APPROVAL;
            case WAITING_PART -> next == ServiceTicketStatus.REPAIRING;
            case WAITING_HANDOVER -> next == ServiceTicketStatus.HANDED_OVER;
            default -> false;
        };
        if (!allowed) throw new InvalidStateTransitionException(old + " -> " + next);
        if (next == ServiceTicketStatus.REPAIRING) {
            if (old == ServiceTicketStatus.WAITING_PART || old == ServiceTicketStatus.WAITING_APPROVAL) {
                var wait = currentWait(ticket);
                BusinessRules.require(wait.getResolvedAt() != null,
                        old == ServiceTicketStatus.WAITING_PART
                                ? "Ghi nhận linh kiện đã sẵn sàng trước khi tiếp tục sửa."
                                : "Ghi nhận đầy đủ quyết định khách hàng trước khi tiếp tục sửa.");
            }
            var assignment = assignments.findFirstByServiceTicket_IdAndStatus(ticket.getId(), AssignmentStatus.ACTIVE)
                    .orElseThrow(() -> new InvalidStateTransitionException("Ticket has no ACTIVE assignment"));
            access.lock(User.class, assignment.getTechnician().getId());
            BusinessRules.require(!assignments.hasOtherActiveRepair(assignment.getTechnician().getId(), ticket.getId()),
                    "Kỹ thuật viên đang sửa một phiếu khác. Hãy hoàn tất hoặc đưa phiếu đó về trạng thái chờ trước khi bắt đầu phiếu này.");
        }
        ticket.setStatus(next);
        var eventAt = history(ticket, old, next, actor, note);
        if (next == ServiceTicketStatus.REPAIRING && ticket.getActualRepairStartedAt() == null) ticket.setActualRepairStartedAt(eventAt);
        if (next == ServiceTicketStatus.WAITING_HANDOVER && ticket.getActualRepairCompletedAt() == null) ticket.setActualRepairCompletedAt(eventAt);
        if (next == ServiceTicketStatus.WAITING_HANDOVER || next == ServiceTicketStatus.CANCELLED) {
            assignments.findFirstByServiceTicket_IdAndStatus(ticket.getId(), AssignmentStatus.ACTIVE).ifPresent(a -> {
                a.setStatus(AssignmentStatus.ENDED);
                a.setEndedAt(eventAt);
            });
        }
        timing.statusChanged(ticket, old, actor);
    }

    void resolveWait(ServiceTicket ticket, LocalDateTime resolvedAt, User actor, String note) {
        BusinessRules.require(ticket.getStatus() == ServiceTicketStatus.WAITING_PART
                        || ticket.getStatus() == ServiceTicketStatus.WAITING_APPROVAL,
                "Phiếu hiện không ở trạng thái chờ cần ghi nhận kết thúc.");
        var wait = currentWait(ticket);
        BusinessRules.require(wait.getResolvedAt() == null, "Điều kiện chờ đã được ghi nhận kết thúc.");
        var now = LocalDateTime.now(clock);
        var actual = resolvedAt == null ? now : resolvedAt;
        BusinessRules.require(!actual.isBefore(wait.getChangedAt()) && !actual.isAfter(now),
                "Thời điểm kết thúc chờ phải từ lúc bắt đầu chờ đến hiện tại.");
        wait.setResolvedAt(actual);
        wait.setResolutionRecordedAt(now);
        wait.setResolvedBy(actor);
        wait.setResolutionNote(BusinessRules.text(note));
        timing.planChanged(ticket, actor);
    }

    boolean currentWaitResolved(ServiceTicket ticket) {
        return (ticket.getStatus() == ServiceTicketStatus.WAITING_PART || ticket.getStatus() == ServiceTicketStatus.WAITING_APPROVAL)
                && currentWait(ticket).getResolvedAt() != null;
    }

    private ServiceStatusHistory currentWait(ServiceTicket ticket) {
        var record = histories.findFirstByServiceTicket_IdOrderByChangedAtDescIdDesc(ticket.getId())
                .orElseThrow(() -> new InvalidStateTransitionException("Ticket status history is missing"));
        BusinessRules.require(record.getToStatus() == ticket.getStatus(), "Ticket status history does not match current state");
        return record;
    }

    private LocalDateTime history(ServiceTicket ticket, ServiceTicketStatus old, ServiceTicketStatus next, User actor, String note) {
        var h = new ServiceStatusHistory();
        h.setServiceTicket(ticket);
        h.setFromStatus(old);
        h.setToStatus(next);
        h.setChangedBy(actor);
        h.setNote(BusinessRules.text(note));
        h.setChangedAt(LocalDateTime.now(clock));
        histories.save(h);
        return h.getChangedAt();
    }
}
