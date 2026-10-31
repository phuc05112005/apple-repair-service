package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PartRepository extends JpaRepository<Part, Long> {

    Optional<Part> findByPartCode(String partCode);

    boolean existsByPartCode(String partCode);

    List<Part> findAllByNameIgnoreCase(String name);

    List<Part> findAllByStatusOrderByNameAsc(ActiveStatus status);

    // Nạp trước deviceModelIds trong 1 truy vấn SQL duy nhất
    @EntityGraph(attributePaths = {"deviceModelIds"})
    @Query("SELECT DISTINCT p FROM Part p")
    List<Part> findAllWithDeviceModels();
}