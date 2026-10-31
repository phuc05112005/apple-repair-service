package com.applecare.apple_repair_service.entity;

import com.applecare.apple_repair_service.enums.PaymentMethod;
import com.applecare.apple_repair_service.enums.PaymentStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_tickets", uniqueConstraints = {
        @UniqueConstraint(name = "uk_service_tickets_ticket_code", columnNames = {"ticket_code"}),
        @UniqueConstraint(name = "uk_service_tickets_appointment_device", columnNames = {"appointment_device_id"})
}, indexes = {
        @Index(name = "idx_service_tickets_status", columnList = "status"),
        @Index(name = "idx_service_tickets_branch", columnList = "branch_id")
})
@Getter
@Setter
@NoArgsConstructor
public class ServiceTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(name = "ticket_code", nullable = false)
    private String ticketCode;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appointment_device_id", nullable = true,
            foreignKey = @ForeignKey(name = "fk_service_tickets_appointment_device"))
    private AppointmentDevice appointmentDevice;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_device_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_service_tickets_customer_device"))
    private CustomerDevice customerDevice;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_service_tickets_branch"))
    private Branch branch;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false,
            foreignKey = @ForeignKey(name = "fk_service_tickets_created_by"))
    private User createdBy;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ServiceTicketStatus status = ServiceTicketStatus.WAITING_ASSIGNMENT;

    @Column(name = "received_condition", columnDefinition = "TEXT")
    private String receivedCondition;

    @Column(name = "customer_reported_issue", columnDefinition = "TEXT")
    private String customerReportedIssue;

    @Column(name = "authorized_scope", columnDefinition = "TEXT")
    private String authorizedScope;

    @Column(name = "inspection_result", columnDefinition = "TEXT")
    private String inspectionResult;

    @NotNull
    @DecimalMin("0.00")
    @DecimalMax("100.00")
    @Column(name = "discount_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPercent = BigDecimal.ZERO;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false)
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method")
    private PaymentMethod paymentMethod;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "handed_over_by", nullable = true,
            foreignKey = @ForeignKey(name = "fk_service_tickets_handed_over_by"))
    private User handedOverBy;

    @Column(name = "handed_over_at")
    private LocalDateTime handedOverAt;

    @Column(name = "cancel_reason", columnDefinition = "TEXT")
    private String cancelReason;

    @NotNull
    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;

    @Column(name="assignment_due_at")
    private LocalDateTime assignmentDueAt;

    @Column(name="initial_estimated_start_at")
    private LocalDateTime initialEstimatedStartAt;

    @Column(name="estimated_start_at")
    private LocalDateTime estimatedStartAt;

    @Column(name="initial_estimated_completion_at")
    private LocalDateTime initialEstimatedCompletionAt;

    @Column(name="estimated_completion_at")
    private LocalDateTime estimatedCompletionAt;

    @Column(name="actual_repair_started_at")
    private LocalDateTime actualRepairStartedAt;

    @Column(name="actual_repair_completed_at")
    private LocalDateTime actualRepairCompletedAt;

    @Column(name="estimated_duration_minutes")
    private Long estimatedDurationMinutes;

    @Enumerated(EnumType.STRING)
    @Column(name="estimate_source")
    private com.applecare.apple_repair_service.enums.EstimateSource estimateSource;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}