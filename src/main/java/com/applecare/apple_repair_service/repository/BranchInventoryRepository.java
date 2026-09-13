package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.BranchInventory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;


public interface BranchInventoryRepository extends JpaRepository<BranchInventory, Long> {

    Optional<BranchInventory> findByBranch_IdAndPart_Id(Long branchId, Long partId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select i from BranchInventory i where i.branch.id = :branchId and i.part.id = :partId")
    Optional<BranchInventory> findByBranchPartForUpdate(@org.springframework.data.repository.query.Param("branchId") Long branchId, @org.springframework.data.repository.query.Param("partId") Long partId);
}
