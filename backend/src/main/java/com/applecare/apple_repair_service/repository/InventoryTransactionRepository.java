package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.InventoryTransaction;
import com.applecare.apple_repair_service.enums.InventoryTransactionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction, Long> {

    @EntityGraph(attributePaths={"part","sourceBranch","destinationBranch","recordedBy","partUsage","inventoryLot"})
    List<InventoryTransaction> findAllByPart_IdOrderByCreatedAtDesc(Long partId);

    @EntityGraph(attributePaths={"part","sourceBranch","destinationBranch","recordedBy","partUsage","inventoryLot"})
    @Query("""
            select t from InventoryTransaction t
            left join t.inventoryLot lot
            where (:branchId is null or t.sourceBranch.id = :branchId or t.destinationBranch.id = :branchId)
              and (:partId is null or t.part.id = :partId)
              and (:type is null or t.transactionType = :type)
              and (:fromTime is null or t.createdAt >= :fromTime)
              and (:toTime is null or t.createdAt < :toTime)
              and (:query is null or :query = '' 
                   or lower(cast(t.id as string)) like lower(concat('%', :query, '%'))
                   or lower(coalesce(lot.lotCode, '')) like lower(concat('%', :query, '%')))
            """)
    Page<InventoryTransaction> search(@Param("branchId") Long branchId,
                                      @Param("partId") Long partId,
                                      @Param("type") InventoryTransactionType type,
                                      @Param("fromTime") LocalDateTime fromTime,
                                      @Param("toTime") LocalDateTime toTime,
                                      @Param("query") String query,
                                      Pageable pageable);
}