package com.applecare.apple_repair_service.repository;
import com.applecare.apple_repair_service.entity.ServiceTimeEstimateHistory;
import org.springframework.data.jpa.repository.*;
import java.util.List;
public interface ServiceTimeEstimateHistoryRepository extends JpaRepository<ServiceTimeEstimateHistory,Long> {
 @EntityGraph(attributePaths={"technician","createdBy"})
 List<ServiceTimeEstimateHistory> findAllByServiceTicket_IdOrderByCreatedAtAscIdAsc(Long id);
}
