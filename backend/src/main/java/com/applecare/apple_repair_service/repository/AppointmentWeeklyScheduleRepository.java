package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.AppointmentWeeklySchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AppointmentWeeklyScheduleRepository extends JpaRepository<AppointmentWeeklySchedule, Long> {
    Optional<AppointmentWeeklySchedule> findByBranch_IdAndWeekday(Long branchId, Integer weekday);
    List<AppointmentWeeklySchedule> findAllByBranch_IdOrderByWeekday(Long branchId);
}
