package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.AppointmentDevice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppointmentDeviceRepository extends JpaRepository<AppointmentDevice, Long> {

    List<AppointmentDevice> findAllByAppointment_Id(Long appointmentId);
}
