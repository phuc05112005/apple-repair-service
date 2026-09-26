package com.applecare.apple_repair_service.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "inventory_lots", uniqueConstraints =
        @UniqueConstraint(name = "uk_inventory_lots_lot_code", columnNames = "lot_code"), indexes =
        @Index(name = "idx_inventory_lots_branch_part_received", columnList = "branch_id,part_id,received_at"))
@Getter @Setter @NoArgsConstructor
public class InventoryLot {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @NotBlank @Size(max = 100) @Column(name = "lot_code", nullable = false, length = 100) private String lotCode;
    @NotNull @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false, foreignKey = @ForeignKey(name = "fk_inventory_lots_branch")) private Branch branch;
    @NotNull @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "part_id", nullable = false, foreignKey = @ForeignKey(name = "fk_inventory_lots_part")) private Part part;
    @NotNull @Positive @Column(name = "received_quantity", nullable = false) private Integer receivedQuantity;
    @NotNull @Column(name = "received_at", nullable = false) private LocalDateTime receivedAt;
    @NotNull @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "received_by", nullable = false, foreignKey = @ForeignKey(name = "fk_inventory_lots_received_by")) private User receivedBy;
    @Column(name = "source_note", columnDefinition = "TEXT") private String sourceNote;
    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
}
