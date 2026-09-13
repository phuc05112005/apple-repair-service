package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceIssue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ServiceIssueRepository extends JpaRepository<ServiceIssue, Long> {
    java.util.List<ServiceIssue> findAllByStatusOrderByNameAsc(com.applecare.apple_repair_service.enums.ActiveStatus status);

    Optional<ServiceIssue> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
