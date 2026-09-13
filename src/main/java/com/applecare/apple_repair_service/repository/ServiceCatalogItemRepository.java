package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceCatalogItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServiceCatalogItemRepository extends JpaRepository<ServiceCatalogItem, Long> {
    @org.springframework.data.jpa.repository.Query("""
            select c from ServiceCatalogItem c
            where c.status = com.applecare.apple_repair_service.enums.ActiveStatus.ACTIVE
              and c.deviceModel.status = com.applecare.apple_repair_service.enums.ActiveStatus.ACTIVE
              and c.deviceModel.deviceType.status = com.applecare.apple_repair_service.enums.ActiveStatus.ACTIVE
              and c.serviceIssue.status = com.applecare.apple_repair_service.enums.ActiveStatus.ACTIVE
              and c.serviceType.status = com.applecare.apple_repair_service.enums.ActiveStatus.ACTIVE
              and (:deviceModelId is null or c.deviceModel.id = :deviceModelId)
              and (:serviceIssueId is null or c.serviceIssue.id = :serviceIssueId)
              and (:serviceTypeId is null or c.serviceType.id = :serviceTypeId)
            order by c.name, c.id
            """)
    List<ServiceCatalogItem> findPublicCatalog(@org.springframework.data.repository.query.Param("deviceModelId") Long deviceModelId,
            @org.springframework.data.repository.query.Param("serviceIssueId") Long serviceIssueId,
            @org.springframework.data.repository.query.Param("serviceTypeId") Long serviceTypeId);

    List<ServiceCatalogItem> findAllByDeviceModel_IdAndServiceIssue_Id(Long deviceModelId, Long serviceIssueId);
}
