package com.applecare.apple_repair_service.entity;

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
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "service_status_histories", indexes = {
        @Index(name = "idx_service_status_histories_ticket_changed_at", columnList = "service_ticket_id, changed_at")
})
@Getter
@Setter
@NoArgsConstructor
public class ServiceStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_ticket_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_service_status_histories_service_ticket"))
    private ServiceTicket serviceTicket;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status")
    private ServiceTicketStatus fromStatus;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false)
    private ServiceTicketStatus toStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by", nullable = true,
            foreignKey = @ForeignKey(name = "fk_service_status_histories_changed_by"))
    private User changedBy;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @NotNull
    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt;
}
