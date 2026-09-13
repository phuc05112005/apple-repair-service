package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.publicapi.*;
import com.applecare.apple_repair_service.dto.request.CreateAppointmentRequest;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PublicController {
    private final PublicQueryService queries;
    private final PublicCommandService commands;
    private final AppointmentSlotService slots;

    @GetMapping("/device-types")
    public List<PublicNamedResponse> deviceTypes() { return queries.deviceTypes(); }
    @GetMapping("/device-models")
    public List<PublicDeviceModelResponse> deviceModels(@RequestParam(required = false) @Positive Long deviceTypeId) {
        return queries.deviceModels(deviceTypeId);
    }
    @GetMapping("/service-issues")
    public List<PublicNamedResponse> serviceIssues() { return queries.serviceIssues(); }
    @GetMapping("/service-catalog-items")
    public List<PublicCatalogResponse> catalog(@RequestParam(required = false) @Positive Long deviceModelId,
            @RequestParam(required = false) @Positive Long serviceIssueId,
            @RequestParam(required = false) @Positive Long serviceTypeId) {
        return queries.catalog(deviceModelId, serviceIssueId, serviceTypeId);
    }
    @GetMapping("/branches")
    public List<PublicBranchResponse> branches() { return queries.branches(); }
    @GetMapping("/appointment-slots")
    public List<SlotAvailabilityResponse> slots(@RequestParam @Positive Long branchId, @RequestParam LocalDate date) {
        return slots.availability(branchId, date);
    }
    @PostMapping("/appointments")
    @ResponseStatus(HttpStatus.CREATED)
    public PublicAppointmentResponse createAppointment(@Valid @RequestBody CreateAppointmentRequest request) {
        return commands.createAppointment(request);
    }
    @GetMapping("/appointments/lookup")
    public List<PublicAppointmentResponse> appointments(@RequestParam @NotBlank @Size(max = 255) String phone) {
        return queries.appointments(phone);
    }
    @GetMapping("/service-tickets/lookup")
    public List<PublicTicketResponse> tickets(@RequestParam @NotBlank @Size(max = 255) String phone) {
        return queries.tickets(phone);
    }
    @GetMapping("/warranties/eligibility")
    public WarrantyEligibilityResponse eligibility(@RequestParam @NotBlank @Size(max = 255) String phone,
                                                   @RequestParam @Positive Long repairItemId) {
        return queries.eligibility(repairItemId, phone);
    }
    @PostMapping("/service-tickets/{ticketCode}/feedback")
    @ResponseStatus(HttpStatus.CREATED)
    public PublicFeedbackResponse feedback(@PathVariable @Size(max = 255) String ticketCode,
                                           @Valid @RequestBody PublicFeedbackRequest request) {
        return commands.feedback(ticketCode, request);
    }
}

