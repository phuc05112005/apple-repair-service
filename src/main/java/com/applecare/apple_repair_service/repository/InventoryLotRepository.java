package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.InventoryLot;
import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface InventoryLotRepository extends JpaRepository<InventoryLot, Long> {
    boolean existsByLotCodeIgnoreCase(String lotCode);
    @EntityGraph(attributePaths = {"branch", "part", "receivedBy"})
    @Query("select l from InventoryLot l where (:branchId is null or l.branch.id=:branchId) and (:partId is null or l.part.id=:partId) order by l.receivedAt desc,l.id desc")
    List<InventoryLot> search(Long branchId, Long partId);
}
