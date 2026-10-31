package com.applecare.apple_repair_service.entity;

import com.applecare.apple_repair_service.enums.ActiveStatus;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "parts", uniqueConstraints = {
        @UniqueConstraint(name = "uk_parts_part_code", columnNames = "part_code")
})
@Getter
@Setter
@NoArgsConstructor
public class Part {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @BatchSize(size = 100)
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "part_device_models", joinColumns = @JoinColumn(name = "part_id"))
    @Column(name = "device_model_id")
    private Set<Long> deviceModelIds = new HashSet<>();

    @Column(name = "service_issue_id")
    private Long serviceIssueId;

    @NotBlank
    @Column(name = "part_code", nullable = false)
    private String partCode;

    @NotBlank
    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "brand")
    private String brand;

    @Column(name = "variant")
    private String variant;

    @Column(name = "origin")
    private String origin;

    @Column(name = "manufacturer")
    private String manufacturer;

    @Column(name = "supplier")
    private String supplier;

    @DecimalMin("0.00")
    @Column(name = "sale_price", nullable = true, precision = 18, scale = 2)
    private BigDecimal salePrice;

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