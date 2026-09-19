package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceIssue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ServiceIssueRepository extends JpaRepository<ServiceIssue, Long> {
    java.util.List<ServiceIssue> findAllByStatusOrderByNameAsc(com.applecare.apple_repair_service.enums.ActiveStatus status);
    java.util.List<ServiceIssue> findAllByDeviceTypes_Id(Long deviceTypeId);
    @org.springframework.data.jpa.repository.Query("select distinct i from ServiceIssue i join i.deviceTypes t where i.status = :status and t.id = :deviceTypeId and t.status = com.applecare.apple_repair_service.enums.ActiveStatus.ACTIVE order by i.name")
    java.util.List<ServiceIssue> findPublicByDeviceType(com.applecare.apple_repair_service.enums.ActiveStatus status, Long deviceTypeId);

    Optional<ServiceIssue> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
