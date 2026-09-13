package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.DeviceType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DeviceTypeRepository extends JpaRepository<DeviceType, Long> {
    java.util.List<DeviceType> findAllByStatusOrderByNameAsc(com.applecare.apple_repair_service.enums.ActiveStatus status);

    Optional<DeviceType> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
