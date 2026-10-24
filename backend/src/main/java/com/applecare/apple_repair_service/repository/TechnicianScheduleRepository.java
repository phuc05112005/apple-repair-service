package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.TechnicianSchedule;
import com.applecare.apple_repair_service.enums.TechnicianScheduleStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;


public interface TechnicianScheduleRepository extends JpaRepository<TechnicianSchedule, Long> {
 @org.springframework.data.jpa.repository.Query("select s from TechnicianSchedule s join fetch s.technician u where s.status=com.applecare.apple_repair_service.enums.TechnicianScheduleStatus.WORKING and u.role=com.applecare.apple_repair_service.enums.UserRole.TECHNICIAN and u.status=com.applecare.apple_repair_service.enums.UserStatus.ACTIVE and s.workDate>=:from and s.workDate<=:until order by s.workDate,s.startTime,s.id")
 java.util.List<TechnicianSchedule> findTimingSchedules(java.time.LocalDate from,java.time.LocalDate until);


    List<TechnicianSchedule> findAllByWorkDateAndStatus(
            LocalDate workDate, TechnicianScheduleStatus status);

    List<TechnicianSchedule> findAllByTechnician_IdAndWorkDate(Long technicianId, LocalDate workDate);

    List<TechnicianSchedule> findAllByBranch_IdAndWorkDateAndStatus(Long branchId, LocalDate workDate, TechnicianScheduleStatus status);
}
