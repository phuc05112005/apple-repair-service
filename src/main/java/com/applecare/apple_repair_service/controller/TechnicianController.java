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
@PreAuthorize("hasRole('TECHNICIAN')")
@RequiredArgsConstructor
public class TechnicianController {
    private final TechnicianOperationsService operations;

    @PostMapping("/service-tickets/{id}/inspection/start")
    public ServiceTicketDetailResponse start(@PathVariable @Positive Long id) { return operations.startInspection(id); }
    @PostMapping("/service-tickets/{id}/inspection")
    public ServiceTicketDetailResponse inspection(@PathVariable @Positive Long id, @Valid @RequestBody InspectionCommand request) {
        return operations.inspect(id,request);
    }
    @PostMapping("/service-tickets/{id}/wait-for-part")
    public ServiceTicketDetailResponse waitForPart(@PathVariable @Positive Long id, @Valid @RequestBody NoteCommand request) {
        return operations.waitForPart(id,request);
    }
    @PostMapping("/service-tickets/{id}/resume-repair")
    public ServiceTicketDetailResponse resume(@PathVariable @Positive Long id) { return operations.resumeRepair(id); }
    @PostMapping("/service-tickets/{id}/finish-repair")
    public ServiceTicketDetailResponse finish(@PathVariable @Positive Long id) { return operations.finishRepair(id); }
    @GetMapping("/service-tickets/{id}/repair-duration")
    public RepairDurationResponse duration(@PathVariable @Positive Long id) { return operations.duration(id); }
    @PostMapping("/repair-items/{id}/part-usages")
    @ResponseStatus(HttpStatus.CREATED)
    public PartUsageResponse usePart(@PathVariable @Positive Long id, @Valid @RequestBody PartUsageCommand request) {
        return operations.usePart(id,request);
    }
    @PostMapping("/part-usages/{id}/reverse")
    public PartUsageResponse reverse(@PathVariable @Positive Long id, @Valid @RequestBody NoteCommand request) {
        return operations.reverseUsage(id,request);
    }
    @PostMapping("/repair-items/{id}/warranty-decision")
    public RepairItemResponse warranty(@PathVariable @Positive Long id, @Valid @RequestBody WarrantyDecisionRequest request) {
        return operations.warranty(id,request);
    }
}

