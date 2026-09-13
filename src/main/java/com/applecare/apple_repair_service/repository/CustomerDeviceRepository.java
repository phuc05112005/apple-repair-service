package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.CustomerDevice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerDeviceRepository extends JpaRepository<CustomerDevice, Long> {

    Optional<CustomerDevice> findBySerialNumber(String serialNumber);

    List<CustomerDevice> findAllByCustomer_Id(Long customerId);
}
