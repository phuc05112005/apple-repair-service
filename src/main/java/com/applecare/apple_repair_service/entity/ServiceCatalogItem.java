package com.applecare.apple_repair_service.entity;

import com.applecare.apple_repair_service.enums.ActiveStatus;
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
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_catalog_items")
@Getter
@Setter
@NoArgsConstructor
public class ServiceCatalogItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "device_model_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_service_catalog_items_device_model"))
    private DeviceModel deviceModel;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_type_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_service_catalog_items_service_type"))
    private ServiceType serviceType;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_issue_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_service_catalog_items_service_issue"))
    private ServiceIssue serviceIssue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "part_id",
            foreignKey = @ForeignKey(name = "fk_service_catalog_items_part"))
    private Part part;

    @NotBlank
    @Column(name = "name", nullable = false)
    private String name;

    @DecimalMin("0.00")
    @Column(name = "configured_price", precision = 18, scale = 2)
    private BigDecimal configuredPrice;

    @Positive
    @Column(name = "standard_duration_minutes")
    private Integer standardDurationMinutes;

    @NotNull
    @PositiveOrZero
    @Column(name = "warranty_days", nullable = false)
    private Integer warrantyDays = 0;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ActiveStatus status = ActiveStatus.ACTIVE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
