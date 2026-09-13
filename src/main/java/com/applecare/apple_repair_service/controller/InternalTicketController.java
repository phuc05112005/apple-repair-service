package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.command.*;
import com.applecare.apple_repair_service.dto.request.WarrantyDecisionRequest;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/internal/service-tickets")
@PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST','TECHNICIAN')")
@RequiredArgsConstructor
public class InternalTicketController {
    private final InternalTicketQueryService queries;
    @GetMapping("/{id}")
    public ServiceTicketDetailResponse ticket(@PathVariable @Positive Long id) { return queries.ticket(id); }
    @GetMapping("/{id}/assignments")
    public List<AssignmentResponse> assignments(@PathVariable @Positive Long id) { return queries.assignments(id); }
    @GetMapping("/{id}/transfers")
    public List<TransferResponse> transfers(@PathVariable @Positive Long id) { return queries.transfers(id); }
}

