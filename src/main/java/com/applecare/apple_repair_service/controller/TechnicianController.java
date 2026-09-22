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
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;

@RestController
@RequestMapping("/api/v1/internal")
@PreAuthorize("hasRole('TECHNICIAN')")
@RequiredArgsConstructor
public class TechnicianController {
    private final TechnicianOperationsService operations;
    private final OperationalQueryService queries;

    @GetMapping("/technician/work")
    public List<OperationalTicketResponse> work(@RequestParam(required=false) ServiceTicketStatus status) {
        return queries.myWork(status);
    }

    @GetMapping("/service-tickets/{id}/transfer-candidates")
    public List<TechnicianRecommendationResponse> transferCandidates(@PathVariable @Positive Long id) {
        return queries.transferCandidates(id);
    }

    @GetMapping("/service-tickets/{id}/available-parts")
    public List<AvailablePartResponse> availableParts(@PathVariable @Positive Long id,
            @RequestParam(required=false) @jakarta.validation.constraints.Size(max=255) String query) {
        return queries.availableParts(id, query);
    }

    @GetMapping("/repair-items/{id}/part-usages")
    public List<PartUsageResponse> partUsages(@PathVariable @Positive Long id) {
        return queries.partUsages(id);
    }

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
    @PostMapping("/technician/repair-items/{id}/approval")
    public RepairItemResponse approval(@PathVariable @Positive Long id, @Valid @RequestBody ApprovalCommand request) {
        return operations.approval(id, request);
    }
    @PostMapping("/repair-items/{id}/warranty-decision")
    public RepairItemResponse warranty(@PathVariable @Positive Long id, @Valid @RequestBody WarrantyDecisionRequest request) {
        return operations.warranty(id,request);
    }
}
