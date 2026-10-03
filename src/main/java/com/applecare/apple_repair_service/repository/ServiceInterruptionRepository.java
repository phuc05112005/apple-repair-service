package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceInterruption;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceInterruptionRepository extends JpaRepository<ServiceInterruption, Long> {
}
