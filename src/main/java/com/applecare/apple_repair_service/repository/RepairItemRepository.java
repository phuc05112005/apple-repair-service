package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.RepairItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RepairItemRepository extends JpaRepository<RepairItem, Long> {
 @org.springframework.data.jpa.repository.Query("select i from RepairItem i join fetch i.serviceCatalogItem c join fetch c.serviceIssue left join fetch i.warrantyReplacementCatalog where i.serviceTicket.id in :ids")
 List<RepairItem> findTimingItems(java.util.Collection<Long> ids);


    List<RepairItem> findAllByServiceTicket_Id(Long serviceTicketId);
}
