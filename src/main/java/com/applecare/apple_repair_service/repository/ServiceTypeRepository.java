package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceType;
import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ServiceTypeRepository extends JpaRepository<ServiceType, Long> {

    Optional<ServiceType> findByCode(ServiceTypeCode code);

    boolean existsByCode(ServiceTypeCode code);

    Optional<ServiceType> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
