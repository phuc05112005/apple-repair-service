package com.applecare.apple_repair_service.entity;

import com.applecare.apple_repair_service.enums.TransferMode;
import com.applecare.apple_repair_service.enums.TransferStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "transfers")
@Getter
@Setter
@NoArgsConstructor
public class Transfer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_assignment_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_transfers_from_assignment"))
    private Assignment fromAssignment;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_technician_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_transfers_target_technician"))
    private User targetTechnician;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "mode", nullable = false)
    private TransferMode mode;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TransferStatus status = TransferStatus.PENDING;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requested_by", nullable = false,
            foreignKey = @ForeignKey(name = "fk_transfers_requested_by"))
    private User requestedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "responded_by",
            foreignKey = @ForeignKey(name = "fk_transfers_responded_by"))
    private User respondedBy;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Column(name = "work_done", columnDefinition = "TEXT")
    private String workDone;

    @Column(name = "current_condition", columnDefinition = "TEXT")
    private String currentCondition;

    @Column(name = "response_note", columnDefinition = "TEXT")
    private String responseNote;

    @NotNull
    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;
}
