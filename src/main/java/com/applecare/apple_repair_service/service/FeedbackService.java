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
}
