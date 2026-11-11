package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.CreateServiceFeedbackRequest;
import com.applecare.apple_repair_service.dto.response.CustomerFeedbackResponse;
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
    public List<CustomerFeedbackResponse> listFeedbacks(Long branchId, Boolean satisfied, LocalDate from, LocalDate to) {
        var start = from != null ? from.atStartOfDay() : LocalDate.of(2000, 1, 1).atStartOfDay();
        var end = to != null ? to.plusDays(1).atStartOfDay() : LocalDate.of(2099, 12, 31).atStartOfDay();

        return repository.findAll().stream()
                .filter(f -> f.getCreatedAt() != null && !f.getCreatedAt().isBefore(start) && f.getCreatedAt().isBefore(end))
                .filter(f -> satisfied == null || java.util.Objects.equals(f.isSatisfied(), satisfied))
                .filter(f -> branchId == null || (f.getServiceTicket() != null && f.getServiceTicket().getBranch() != null
                        && java.util.Objects.equals(f.getServiceTicket().getBranch().getId(), branchId)))
                .map(f -> {
                    var ticket = f.getServiceTicket();
                    var device = ticket != null ? ticket.getCustomerDevice() : null;
                    var customer = device != null ? device.getCustomer() : null;
                    var model = device != null ? device.getDeviceModel() : null;
                    var branch = ticket != null ? ticket.getBranch() : null;
                    return new CustomerFeedbackResponse(
                            f.getId(),
                            ticket != null ? ticket.getId() : null,
                            ticket != null ? ticket.getTicketCode() : "",
                            customer != null ? customer.getFullName() : "Khách lẻ",
                            customer != null ? customer.getPhone() : "—",
                            model != null ? model.getName() : "Chưa xác định",
                            branch != null ? branch.getName() : "Hệ thống",
                            f.isSatisfied(),
                            f.getComment(),
                            f.getCreatedAt()
                    );
                })
                .sorted((a, b) -> b.createdAt().compareTo(a.createdAt()))
                .toList();
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
