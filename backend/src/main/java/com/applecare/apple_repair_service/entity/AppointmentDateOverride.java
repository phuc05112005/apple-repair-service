package com.applecare.apple_repair_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDate;

@Entity
@Table(name = "appointment_date_overrides", uniqueConstraints =
        @UniqueConstraint(name = "uk_appointment_override_branch_date", columnNames = {"branch_id", "appointment_date"}))
@Getter @Setter @NoArgsConstructor
public class AppointmentDateOverride {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;
    @Column(name = "appointment_date", nullable = false)
    private LocalDate appointmentDate;
    @Column(name = "mode", nullable = false, length = 16)
    private String mode;
    @Column(name = "slots_json", nullable = false, columnDefinition = "text")
    private String slotsJson = "[]";
}
