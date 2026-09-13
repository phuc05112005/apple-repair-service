package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BranchRepository extends JpaRepository<Branch, Long> {
    java.util.List<Branch> findAllByStatusOrderByNameAsc(com.applecare.apple_repair_service.enums.ActiveStatus status);
}
