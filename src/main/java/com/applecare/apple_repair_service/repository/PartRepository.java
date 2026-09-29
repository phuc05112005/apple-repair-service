package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.Part;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import com.applecare.apple_repair_service.enums.ActiveStatus;

public interface PartRepository extends JpaRepository<Part, Long> {

    Optional<Part> findByPartCode(String partCode);

    boolean existsByPartCode(String partCode);

    List<Part> findAllByNameIgnoreCase(String name);

    List<Part> findAllByStatusOrderByNameAsc(ActiveStatus status);
}
