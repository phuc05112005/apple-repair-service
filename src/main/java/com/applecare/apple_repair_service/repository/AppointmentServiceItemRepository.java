package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.AppointmentServiceItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppointmentServiceItemRepository extends JpaRepository<AppointmentServiceItem, Long> {

    List<AppointmentServiceItem> findAllByAppointmentDevice_Id(Long appointmentDeviceId);
}
