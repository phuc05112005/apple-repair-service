package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.AppointmentDateOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.Optional;

public interface AppointmentDateOverrideRepository extends JpaRepository<AppointmentDateOverride, Long> {
    Optional<AppointmentDateOverride> findByBranch_IdAndAppointmentDate(Long branchId, LocalDate date);
}
