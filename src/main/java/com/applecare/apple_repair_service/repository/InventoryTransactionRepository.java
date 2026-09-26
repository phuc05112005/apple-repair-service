package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.InventoryTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction, Long> {

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths={"part","sourceBranch","destinationBranch","recordedBy","partUsage","inventoryLot"})
    List<InventoryTransaction> findAllByPart_IdOrderByCreatedAtDesc(Long partId);
}
