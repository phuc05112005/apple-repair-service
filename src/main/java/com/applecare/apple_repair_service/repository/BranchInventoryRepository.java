package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.BranchInventory;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;


public interface BranchInventoryRepository extends JpaRepository<BranchInventory, Long> {

    Optional<BranchInventory> findByBranch_IdAndPart_Id(Long branchId, Long partId);

    @org.springframework.data.jpa.repository.Query("""
            select i from BranchInventory i
            where i.branch.id = :branchId
              and i.part.status = :status
              and (:term is null
                   or lower(i.part.partCode) like lower(concat('%', :term, '%'))
                   or lower(i.part.name) like lower(concat('%', :term, '%'))
                   or lower(coalesce(i.part.brand, '')) like lower(concat('%', :term, '%'))
                   or lower(coalesce(i.part.variant, '')) like lower(concat('%', :term, '%')))
            order by i.part.name, i.part.id
            """)
    List<BranchInventory> findAvailableParts(
            @org.springframework.data.repository.query.Param("branchId") Long branchId,
            @org.springframework.data.repository.query.Param("status") ActiveStatus status,
            @org.springframework.data.repository.query.Param("term") String term);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select i from BranchInventory i where i.branch.id = :branchId and i.part.id = :partId")
    Optional<BranchInventory> findByBranchPartForUpdate(@org.springframework.data.repository.query.Param("branchId") Long branchId, @org.springframework.data.repository.query.Param("partId") Long partId);
}
