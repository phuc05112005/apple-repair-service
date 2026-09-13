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
@RequestMapping("/api/v1/internal")
@RequiredArgsConstructor
public class TransferController {
    private final TransferOperationsService operations;
    @PostMapping("/service-tickets/{ticketId}/transfers/request")
    @PreAuthorize("hasRole('TECHNICIAN')")
    @ResponseStatus(HttpStatus.CREATED)
    public TransferResponse request(@PathVariable @Positive Long ticketId, @Valid @RequestBody TransferCommand request) {
        return operations.request(ticketId,request);
    }
    @PostMapping("/service-tickets/{ticketId}/transfers/direct")
    @PreAuthorize("hasRole('RECEPTIONIST')")
    public TransferResponse direct(@PathVariable @Positive Long ticketId, @Valid @RequestBody TransferCommand request) {
        return operations.direct(ticketId,request);
    }
    @PostMapping("/transfers/{id}/accept")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public TransferResponse accept(@PathVariable @Positive Long id, @Valid @RequestBody NoteCommand request) { return operations.accept(id,request); }
    @PostMapping("/transfers/{id}/reject")
    @PreAuthorize("hasRole('TECHNICIAN')")
    public TransferResponse reject(@PathVariable @Positive Long id, @Valid @RequestBody NoteCommand request) { return operations.reject(id,request); }
    @PostMapping("/transfers/{id}/cancel")
    @PreAuthorize("hasAnyRole('TECHNICIAN','RECEPTIONIST')")
    public TransferResponse cancel(@PathVariable @Positive Long id, @Valid @RequestBody NoteCommand request) { return operations.cancel(id,request); }
}

