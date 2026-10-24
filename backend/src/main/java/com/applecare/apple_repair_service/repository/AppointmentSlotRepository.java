package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.AppointmentSlot;
import com.applecare.apple_repair_service.enums.AppointmentSlotStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface AppointmentSlotRepository extends JpaRepository<AppointmentSlot, Long> {

    List<AppointmentSlot> findAllByBranch_IdAndAppointmentDateOrderByStartTime(Long branchId, LocalDate appointmentDate);

    java.util.Optional<AppointmentSlot> findByBranch_IdAndAppointmentDateAndStartTimeAndEndTime(
            Long branchId, LocalDate appointmentDate, java.time.LocalTime startTime, java.time.LocalTime endTime);

    List<AppointmentSlot> findAllByBranch_IdAndAppointmentDateAndStatusOrderByStartTime(
            Long branchId, LocalDate appointmentDate, AppointmentSlotStatus status);
}
