package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.InventoryTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.time.LocalDateTime;

import com.applecare.apple_repair_service.enums.InventoryTransactionType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction, Long> {

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths={"part","sourceBranch","destinationBranch","recordedBy","partUsage","inventoryLot"})
    List<InventoryTransaction> findAllByPart_IdOrderByCreatedAtDesc(Long partId);

    @EntityGraph(attributePaths={"part","sourceBranch","destinationBranch","recordedBy","partUsage","inventoryLot"})
    @Query("""
            select t from InventoryTransaction t
            where (:branchId is null or t.sourceBranch.id = :branchId or t.destinationBranch.id = :branchId)
              and (:partId is null or t.part.id = :partId)
              and (:type is null or t.transactionType = :type)
              and (:fromTime is null or t.createdAt >= :fromTime)
              and (:toTime is null or t.createdAt < :toTime)
            order by t.createdAt desc, t.id desc
            """)
    List<InventoryTransaction> search(@Param("branchId") Long branchId,
                                      @Param("partId") Long partId,
                                      @Param("type") InventoryTransactionType type,
                                      @Param("fromTime") LocalDateTime fromTime,
                                      @Param("toTime") LocalDateTime toTime);
}
