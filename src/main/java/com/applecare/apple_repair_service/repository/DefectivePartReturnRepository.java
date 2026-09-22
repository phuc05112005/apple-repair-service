package com.applecare.apple_repair_service.repository;
import com.applecare.apple_repair_service.entity.DefectivePartReturn;
import com.applecare.apple_repair_service.enums.DefectivePartStatus;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface DefectivePartReturnRepository extends JpaRepository<DefectivePartReturn,Long> {
 Optional<DefectivePartReturn> findBySourcePartUsage_Id(Long id);
 @Query("select d from DefectivePartReturn d join fetch d.branch join fetch d.part join fetch d.recordedBy join fetch d.sourcePartUsage u join fetch u.repairItem i join fetch i.serviceTicket where (:branchId is null or d.branch.id=:branchId) and (:partId is null or d.part.id=:partId) and (:status is null or d.status=:status) and (:ticketId is null or i.serviceTicket.id=:ticketId) order by d.receivedAt desc,d.id desc")
 List<DefectivePartReturn> search(Long branchId,Long partId,DefectivePartStatus status,Long ticketId);
 @Query("select coalesce(sum(d.quantity),0) from DefectivePartReturn d where d.branch.id=:branchId and d.part.id=:partId and d.status=com.applecare.apple_repair_service.enums.DefectivePartStatus.IN_STOCK")
 long onHand(Long branchId,Long partId);
}
