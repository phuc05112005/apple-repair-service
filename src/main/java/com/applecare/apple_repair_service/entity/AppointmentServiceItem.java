package com.applecare.apple_repair_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "appointment_service_items", uniqueConstraints = {
        @UniqueConstraint(name = "uk_appointment_service_items_device_catalog", columnNames = {"appointment_device_id", "service_catalog_item_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class AppointmentServiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "appointment_device_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_appointment_service_items_appointment_device"))
    private AppointmentDevice appointmentDevice;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_catalog_item_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_appointment_service_items_service_catalog_item"))
    private ServiceCatalogItem serviceCatalogItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warranty_source_item_id", nullable = true,
            foreignKey = @ForeignKey(name = "fk_appointment_service_items_warranty_source_item"))
    private RepairItem warrantySourceItem;

    @NotBlank
    @Column(name = "service_name_snapshot", nullable = false)
    private String serviceNameSnapshot;

    @DecimalMin("0.00")
    @Column(name = "base_price_snapshot", precision = 18, scale = 2)
    private BigDecimal basePriceSnapshot;

    @DecimalMin("0.00")
    @Column(name = "final_price_snapshot", precision = 18, scale = 2)
    private BigDecimal finalPriceSnapshot;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
