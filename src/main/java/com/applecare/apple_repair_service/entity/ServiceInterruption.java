package com.applecare.apple_repair_service.entity;

import com.applecare.apple_repair_service.enums.InterruptionReason;
import com.applecare.apple_repair_service.enums.InterruptionResponsibility;
import com.applecare.apple_repair_service.enums.InterruptionSource;
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
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "service_interruptions", indexes = {
        @Index(name = "idx_service_interruptions_assignment_started",
                columnList = "assignment_id, started_at"),
        @Index(name = "idx_service_interruptions_incident_group",
                columnList = "incident_group_code"),
        @Index(name = "idx_service_interruptions_verified_started",
                columnList = "verified, started_at")
})
@Check(name = "ck_service_interruptions_time_order",
        constraints = "ended_at IS NULL OR ended_at >= started_at")
@Getter
@Setter
@NoArgsConstructor
public class ServiceInterruption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_service_interruptions_assignment"))
    private Assignment assignment;

    @NotNull
    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false)
    private InterruptionReason reason;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "responsibility_scope", nullable = false)
    private InterruptionResponsibility responsibilityScope;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false)
    private InterruptionSource source;

    @ColumnDefault("false")
    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Size(max = 100)
    @Column(name = "incident_group_code", length = 100)
    private String incidentGroupCode;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recorded_by", nullable = false,
            foreignKey = @ForeignKey(name = "fk_service_interruptions_recorded_by"))
    private User recordedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
