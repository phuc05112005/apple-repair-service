package com.applecare.apple_repair_service.entity;

import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.WarrantyDecision;
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
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "repair_items")
@Getter
@Setter
@NoArgsConstructor
public class RepairItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_ticket_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_repair_items_service_ticket"))
    private ServiceTicket serviceTicket;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_catalog_item_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_repair_items_service_catalog_item"))
    private ServiceCatalogItem serviceCatalogItem;

    @NotBlank
    @Column(name = "item_name_snapshot", nullable = false)
    private String itemNameSnapshot;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false)
    private ApprovalStatus approvalStatus = ApprovalStatus.PENDING;

    @DecimalMin("0.00")
    @Column(name = "base_price", precision = 18, scale = 2)
    private BigDecimal basePrice;

    @DecimalMin("0.00")
    @Column(name = "final_price", precision = 18, scale = 2)
    private BigDecimal finalPrice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approval_recorded_by", nullable = true,
            foreignKey = @ForeignKey(name = "fk_repair_items_approval_recorded_by"))
    private User approvalRecordedBy;

    @Column(name = "approval_decision_at")
    private LocalDateTime approvalDecisionAt;

    @Column(name = "approval_note", columnDefinition = "TEXT")
    private String approvalNote;

    @Column(name = "warranty_start_date")
    private LocalDate warrantyStartDate;

    @Column(name = "warranty_end_date")
    private LocalDate warrantyEndDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warranty_source_item_id", nullable = true,
            foreignKey = @ForeignKey(name = "fk_repair_items_warranty_source_item"))
    private RepairItem warrantySourceItem;

    @Enumerated(EnumType.STRING)
    @Column(name = "warranty_decision")
    private WarrantyDecision warrantyDecision;

    @Column(name = "warranty_decision_note", columnDefinition = "TEXT")
    private String warrantyDecisionNote;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
