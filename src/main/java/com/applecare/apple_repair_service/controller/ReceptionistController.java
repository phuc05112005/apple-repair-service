package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.command.*;
import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.enums.AppointmentStatus;
import com.applecare.apple_repair_service.security.CurrentActor;
import com.applecare.apple_repair_service.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/internal")
@PreAuthorize("hasRole('RECEPTIONIST')")
@RequiredArgsConstructor
public class ReceptionistController {
    private final AppointmentService appointments;
    private final ServiceTicketService tickets;
    private final AssignmentService assignments;
    private final TechnicianRecommendationService recommendations;
    private final RepairItemService items;
    private final PaymentService payments;
    private final CurrentActor actor;

    @GetMapping("/appointments")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public List<AppointmentDetailResponse> appointments(@RequestParam(required=false) @Positive Long branchId,
            @RequestParam(required=false) LocalDate date, @RequestParam(required=false) AppointmentStatus status) {
        return appointments.list(branchId,date,status);
    }
    @GetMapping("/appointments/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','RECEPTIONIST')")
    public AppointmentDetailResponse appointment(@PathVariable @Positive Long id) { return appointments.getById(id); }
    @GetMapping("/appointments/ready-for-intake")
    public List<AppointmentDetailResponse> readyForIntake() { return appointments.readyForIntake(); }
    @PostMapping("/appointments/{id}/confirm")
    public AppointmentDetailResponse confirm(@PathVariable @Positive Long id) {
        return appointments.confirmAppointment(id,new ConfirmAppointmentRequest(actor.id()));
    }
    @PostMapping("/appointments/{id}/reschedule")
    public AppointmentDetailResponse reschedule(@PathVariable @Positive Long id, @Valid @RequestBody RescheduleAppointmentRequest request) {
        return appointments.rescheduleAppointment(id,request);
    }
    @PostMapping("/appointments/{id}/cancel")
    public AppointmentDetailResponse cancelAppointment(@PathVariable @Positive Long id, @Valid @RequestBody ReasonCommand request) {
        return appointments.cancelAppointment(id,new CancelAppointmentRequest(request.reason()));
    }
    @PostMapping("/appointments/{id}/arrive")
    public AppointmentDetailResponse arrive(@PathVariable @Positive Long id) { return appointments.markArrived(id); }
    @PostMapping("/appointments/{id}/expire")
    public AppointmentDetailResponse expire(@PathVariable @Positive Long id) { return appointments.expireAppointment(id); }
    @PostMapping("/appointment-devices/{appointmentDeviceId}/intake")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceTicketDetailResponse intake(@PathVariable @Positive Long appointmentDeviceId, @Valid @RequestBody IntakeDeviceCommand request) {
        return tickets.intakeAppointmentDevice(new IntakeAppointmentDeviceRequest(appointmentDeviceId,request.serialNumber(),
                request.storage(),request.receivedCondition(),request.serviceCatalogItemIds(),actor.id()));
    }
    @PostMapping("/service-tickets/walk-in")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceTicketDetailResponse walkIn(@Valid @RequestBody WalkInIntakeRequest request) {
        return tickets.createWalkInTicket(request,actor.id());
    }
    @PostMapping("/service-tickets/{id}/cancel")
    public ServiceTicketDetailResponse cancelTicket(@PathVariable @Positive Long id, @Valid @RequestBody ReasonCommand request) {
        return tickets.cancelTicket(id,actor.id(),request.reason());
    }
    @GetMapping("/service-tickets/{id}/technician-recommendations")
    public List<TechnicianRecommendationResponse> recommend(@PathVariable @Positive Long id) { return recommendations.recommend(id); }
    @PostMapping("/service-tickets/{id}/assignments")
    @ResponseStatus(HttpStatus.CREATED)
    public AssignmentResponse assign(@PathVariable @Positive Long id, @Valid @RequestBody AssignTechnicianCommand request) {
        return assignments.assignTechnician(id,new AssignTechnicianRequest(request.technicianId(),actor.id(),request.source()));
    }
    @PostMapping("/repair-items/{id}/approval")
    public RepairItemResponse approval(@PathVariable @Positive Long id, @Valid @RequestBody ApprovalCommand request) {
        return items.recordApprovalDecision(id,new ApprovalDecisionRequest(request.decision(),actor.id(),request.note()));
    }
    @GetMapping("/service-tickets/{id}/payment-summary")
    public TicketPaymentSummaryResponse paymentSummary(@PathVariable @Positive Long id) { return payments.getSummary(id); }
    @PostMapping("/service-tickets/{id}/payment")
    public TicketPaymentSummaryResponse payment(@PathVariable @Positive Long id, @Valid @RequestBody RecordPaymentRequest request) {
        return payments.recordPayment(id,request);
    }
    @PostMapping("/service-tickets/{id}/payment/settle-zero")
    public TicketPaymentSummaryResponse settleZero(@PathVariable @Positive Long id) { return payments.settleZeroAmountTicket(id); }
    @PostMapping("/service-tickets/{id}/handover")
    public ServiceTicketDetailResponse handover(@PathVariable @Positive Long id) { return tickets.handover(id,new HandoverRequest(actor.id())); }
}
