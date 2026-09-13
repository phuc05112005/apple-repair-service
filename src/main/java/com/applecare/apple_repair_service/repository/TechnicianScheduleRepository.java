package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.TechnicianSchedule;
import com.applecare.apple_repair_service.enums.TechnicianScheduleStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;


public interface TechnicianScheduleRepository extends JpaRepository<TechnicianSchedule, Long> {

    List<TechnicianSchedule> findAllByWorkDateAndStatus(
            LocalDate workDate, TechnicianScheduleStatus status);

    List<TechnicianSchedule> findAllByTechnician_IdAndWorkDate(Long technicianId, LocalDate workDate);

    List<TechnicianSchedule> findAllByBranch_IdAndWorkDateAndStatus(Long branchId, LocalDate workDate, TechnicianScheduleStatus status);
}
