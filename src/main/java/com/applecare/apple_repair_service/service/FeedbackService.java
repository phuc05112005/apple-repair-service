package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateServiceFeedbackRequest;
import com.applecare.apple_repair_service.dto.response.ServiceFeedbackResponse;
import com.applecare.apple_repair_service.entity.ServiceFeedback;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.ServiceFeedbackRepository;
import com.applecare.apple_repair_service.dto.response.FeedbackStatisticsResponse;
import java.time.LocalDate;
import java.util.List;
import com.applecare.apple_repair_service.dto.response.FeedbackBranchStatisticsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FeedbackService {
    private final ServiceFeedbackRepository repository;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ServiceFeedbackResponse createFeedback(CreateServiceFeedbackRequest r) {
        rules.validate(r);
        var ticket = access.lock(ServiceTicket.class, r.serviceTicketId());
        BusinessRules.require(ticket.getStatus() == ServiceTicketStatus.HANDED_OVER, "Feedback requires HANDED_OVER ticket");
        if (repository.findByServiceTicket_Id(ticket.getId()).isPresent())
            throw new ConflictException("Feedback already exists");
        var f = new ServiceFeedback();
        f.setServiceTicket(ticket);
        f.setSatisfied(r.satisfied());
        f.setComment(BusinessRules.text(r.comment()));
        try {
            return mapper.map(repository.saveAndFlush(f));
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Feedback already exists");
        }
    }

    public ServiceFeedbackResponse getByTicket(Long ticketId) {
        return repository.findByServiceTicket_Id(ticketId).map(mapper::map).orElseThrow(() -> new ResourceNotFoundException("Feedback not found"));
    }

    @Transactional(readOnly = true)
    public FeedbackStatisticsResponse statistics(LocalDate from, LocalDate to) {
        BusinessRules.require(from != null && to != null && !from.isAfter(to), "Invalid feedback date range");
        var start = from.atStartOfDay();
        var end = to.plusDays(1).atStartOfDay();
        long total = repository.countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(start, end);
        long satisfied = repository.countBySatisfiedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(start, end);
        long dissatisfied = repository.countBySatisfiedFalseAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(start, end);
        List<FeedbackBranchStatisticsResponse> branches = repository.aggregateByBranch(start, end).stream()
                .map(row -> {
                    long branchTotal = row.getTotal() == null ? 0L : row.getTotal();
                    long branchSatisfied = row.getSatisfied() == null ? 0L : row.getSatisfied();
                    long branchDissatisfied = branchTotal - branchSatisfied;
                    return new FeedbackBranchStatisticsResponse(row.getBranchId(), row.getBranchName(),
                            branchTotal, branchSatisfied, branchDissatisfied,
                            branchTotal == 0 ? 0d : (double) branchSatisfied / branchTotal);
                }).toList();
        return new FeedbackStatisticsResponse(from, to, total, satisfied, dissatisfied,
                total == 0 ? 0d : (double) satisfied / total, branches);
    }
}
