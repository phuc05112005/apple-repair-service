package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.publicapi.*;
import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.exception.ResourceNotFoundException;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PublicCommandService {
    private final AppointmentService appointments;
    private final PublicQueryService queries;
    private final ServiceTicketRepository tickets;
    private final FeedbackService feedback;
    private final BusinessRules rules;

    // Keep the existing whole-attempt retry boundary; map public data in a separate read transaction.
    public PublicAppointmentResponse createAppointment(CreateAppointmentRequest request) {
        var created = appointments.createAppointment(request);
        return queries.appointment(created.appointment().id());
    }
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public PublicFeedbackResponse feedback(String ticketCode, PublicFeedbackRequest request) {
        rules.validate(request);
        var ticket = tickets.findByTicketCode(ticketCode)
                .orElseThrow(() -> new ResourceNotFoundException("Service record not found"));
        PublicQueryService.requireOwner(ticket, request.phone());
        var result = feedback.createFeedback(new CreateServiceFeedbackRequest(ticket.getId(), request.satisfied(), request.comment()));
        return new PublicFeedbackResponse(ticket.getTicketCode(), result.satisfied(), result.comment());
    }
}

