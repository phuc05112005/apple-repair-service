package com.applecare.apple_repair_service.entity;

import com.applecare.apple_repair_service.enums.ActiveStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "service_issues", uniqueConstraints = {
        @UniqueConstraint(name = "uk_service_issues_name", columnNames = "name")
})
@Getter
@Setter
@NoArgsConstructor
public class ServiceIssue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(name = "name", nullable = false)
    private String name;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ActiveStatus status = ActiveStatus.ACTIVE;

    @ManyToMany
    @JoinTable(name = "service_issue_device_types",
            joinColumns = @JoinColumn(name = "service_issue_id"),
            inverseJoinColumns = @JoinColumn(name = "device_type_id"),
            uniqueConstraints = @UniqueConstraint(name = "uk_service_issue_device_type", columnNames = {"service_issue_id", "device_type_id"}))
    private Set<DeviceType> deviceTypes = new HashSet<>();

    @Column(name = "mapping_initialized", nullable = false, columnDefinition = "boolean not null default false")
    private boolean mappingInitialized;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
