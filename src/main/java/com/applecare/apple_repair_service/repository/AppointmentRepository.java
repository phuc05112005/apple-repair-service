package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.Appointment;
import com.applecare.apple_repair_service.enums.AppointmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    @org.springframework.data.jpa.repository.Query("select a from Appointment a where (:branchId is null or a.appointmentSlot.branch.id = :branchId) and (:date is null or a.appointmentSlot.appointmentDate = :date) and (:status is null or a.status = :status) order by a.bookedAt desc, a.id desc")
    List<Appointment> findFiltered(@org.springframework.data.repository.query.Param("branchId") Long branchId,
            @org.springframework.data.repository.query.Param("date") java.time.LocalDate date,
            @org.springframework.data.repository.query.Param("status") AppointmentStatus status);

    boolean existsByAppointmentSlot_Id(Long slotId);

    List<Appointment> findAllByCustomer_PhoneOrderByBookedAtDesc(String phone);

    long countByAppointmentSlot_IdAndStatusNotIn(
            Long appointmentSlotId, Collection<AppointmentStatus> statuses);
}
