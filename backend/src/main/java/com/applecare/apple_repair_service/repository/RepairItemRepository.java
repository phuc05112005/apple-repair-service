package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.RepairItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface RepairItemRepository extends JpaRepository<RepairItem, Long> {

    @Query("select i from RepairItem i join fetch i.serviceCatalogItem c join fetch c.serviceIssue left join fetch i.warrantyReplacementCatalog where i.serviceTicket.id in :ids")
    List<RepairItem> findTimingItems(@Param("ids") Collection<Long> ids);

    @Query("""
            select distinct i from RepairItem i
            left join fetch i.serviceCatalogItem c
            left join fetch c.serviceIssue
            left join fetch i.warrantyReplacementCatalog
            left join fetch i.approvalRecordedBy
            left join fetch i.warrantySourceItem
            where i.serviceTicket.id = :serviceTicketId
            order by i.createdAt asc, i.id asc
            """)
    List<RepairItem> findByServiceTicket_IdWithDetails(@Param("serviceTicketId") Long serviceTicketId);

    List<RepairItem> findAllByServiceTicket_Id(Long serviceTicketId);

    List<RepairItem> findAllByWarrantySourceItem_IdOrderByCreatedAtDesc(Long sourceItemId);
}