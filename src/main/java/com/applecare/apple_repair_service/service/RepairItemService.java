package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.ApprovalDecisionRequest;
import com.applecare.apple_repair_service.dto.response.RepairItemResponse;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.RepairItemRepository;
import com.applecare.apple_repair_service.repository.ServiceStatusHistoryRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RepairItemService {
    private final RepairItemRepository repository;
    private final ServiceStatusHistoryRepository histories;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final ServiceStatusService statuses;
    private final EntityResponses mapper;
    private final Clock clock;

    public List<RepairItemResponse> listByTicket(Long id) {
        access.get(ServiceTicket.class, id);
        return repository.findAllByServiceTicket_Id(id).stream().map(mapper::map).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public RepairItemResponse recordApprovalDecision(Long id, ApprovalDecisionRequest r) {
        rules.validate(r);
        BusinessRules.require(r.decision() != ApprovalStatus.PENDING, "Decision must be APPROVED or REJECTED");
        var initial = access.get(RepairItem.class, id);
        var t = access.lock(ServiceTicket.class, initial.getServiceTicket().getId());
        var item = access.lock(RepairItem.class, id);
        BusinessRules.require(t.getStatus() == ServiceTicketStatus.WAITING_APPROVAL && item.getApprovalStatus() == ApprovalStatus.PENDING, "Approval is no longer pending");
        var actor = access.get(User.class, r.recordedByUserId());
        BusinessRules.require(r.confirmationMethod() != null, "Chọn hình thức ghi nhận ý kiến khách hàng.");
        if (r.confirmationMethod() == com.applecare.apple_repair_service.enums.ConfirmationMethod.PRE_AUTHORIZED)
            BusinessRules.required(t.getAuthorizedScope(), "Phiếu chưa có phạm vi cho phép trước");
        item.setConfirmationMethod(r.confirmationMethod());
        item.setApprovalStatus(r.decision());
        item.setApprovalRecordedBy(actor);
        var recordedAt = LocalDateTime.now(clock);
        var resolvedAt = r.resolvedAt() == null ? recordedAt : r.resolvedAt();
        var wait = histories.findFirstByServiceTicket_IdOrderByChangedAtDescIdDesc(t.getId())
                .orElseThrow(() -> new com.applecare.apple_repair_service.exception.InvalidStateTransitionException("Ticket status history is missing"));
        BusinessRules.require(!resolvedAt.isBefore(wait.getChangedAt()) && !resolvedAt.isAfter(recordedAt),
                "Thời điểm khách phản hồi phải từ lúc bắt đầu chờ đến hiện tại.");
        item.setApprovalDecisionAt(recordedAt);
        item.setApprovalResolvedAt(resolvedAt);
        item.setApprovalNote(BusinessRules.text(r.note()));
        repository.flush();
        var all = repository.findAllByServiceTicket_Id(t.getId());
        if (all.stream().noneMatch(x -> x.getApprovalStatus() == ApprovalStatus.PENDING)) {
            var resolved = all.stream().map(RepairItem::getApprovalResolvedAt).filter(java.util.Objects::nonNull)
                    .max(LocalDateTime::compareTo).orElse(recordedAt);
            statuses.resolveWait(t, resolved, actor, "Đã ghi nhận đầy đủ quyết định của khách hàng");
        }
        return mapper.map(item);
    }
}
