package com.applecare.apple_repair_service.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "appointment_weekly_schedules", uniqueConstraints =
        @UniqueConstraint(name = "uk_appointment_weekly_branch_day", columnNames = {"branch_id", "weekday"}))
@Getter @Setter @NoArgsConstructor
public class AppointmentWeeklySchedule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;
    @Column(name = "weekday", nullable = false)
    private Integer weekday;
    @Column(name = "enabled", nullable = false)
    private boolean enabled;
    @Column(name = "slots_json", nullable = false, columnDefinition = "text")
    private String slotsJson = "[]";
}
