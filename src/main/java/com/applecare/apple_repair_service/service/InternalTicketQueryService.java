package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.response.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.List;

@Service
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','TECHNICIAN')")
@Transactional(isolation=Isolation.READ_COMMITTED)
public class InternalTicketQueryService {
    private final TicketAccessPolicy policy;
    private final ServiceTicketService tickets;
    private final AssignmentService assignments;
    private final TransferService transfers;
    public ServiceTicketDetailResponse ticket(Long id) { policy.requireRead(id); return tickets.getById(id); }
    public List<AssignmentResponse> assignments(Long id) { policy.requireRead(id); return assignments.getHistory(id); }
    public List<TransferResponse> transfers(Long id) { policy.requireRead(id); return transfers.getHistory(id); }
}

