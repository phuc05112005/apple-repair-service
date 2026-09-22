package com.applecare.apple_repair_service.entity;
import com.applecare.apple_repair_service.enums.EstimateSource;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;
@Entity @Getter @Setter @NoArgsConstructor
@Table(name="service_time_estimate_histories",indexes=@Index(name="idx_time_estimate_ticket_created",columnList="service_ticket_id,created_at"))
public class ServiceTimeEstimateHistory {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @NotNull @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="service_ticket_id",nullable=false,foreignKey=@ForeignKey(name="fk_time_estimate_ticket")) private ServiceTicket serviceTicket;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="technician_id",foreignKey=@ForeignKey(name="fk_time_estimate_technician")) private User technician;
 @Column(name="estimated_start_at") private LocalDateTime estimatedStartAt;
 @Column(name="estimated_completion_at") private LocalDateTime estimatedCompletionAt;
 @Column(name="estimated_duration_minutes") private Long estimatedDurationMinutes;
 @NotNull @Enumerated(EnumType.STRING) @Column(name="estimate_source",nullable=false) private EstimateSource estimateSource;
 @NotBlank @Column(nullable=false,columnDefinition="TEXT") private String reason;
 @NotNull @Column(name="break_minutes_snapshot",nullable=false) private Integer breakMinutesSnapshot;
 @Column(name="approved_price_snapshot",precision=18,scale=2) private BigDecimal approvedPriceSnapshot;
 @NotNull @Column(name="created_at",nullable=false) private LocalDateTime createdAt;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="created_by",foreignKey=@ForeignKey(name="fk_time_estimate_actor")) private User createdBy;
}
