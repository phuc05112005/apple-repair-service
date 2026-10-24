package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ServiceFeedbackRepository extends JpaRepository<ServiceFeedback, Long> {

    Optional<ServiceFeedback> findByServiceTicket_Id(Long serviceTicketId);

    long countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(LocalDateTime from, LocalDateTime to);
    long countBySatisfiedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(LocalDateTime from, LocalDateTime to);
    long countBySatisfiedFalseAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(LocalDateTime from, LocalDateTime to);

    @Query("""
        select f.serviceTicket.branch.id as branchId,
               f.serviceTicket.branch.name as branchName,
               count(f) as total,
               sum(case when f.satisfied = true then 1 else 0 end) as satisfied
        from ServiceFeedback f
        where f.createdAt >= :from and f.createdAt < :to
        group by f.serviceTicket.branch.id, f.serviceTicket.branch.name
        order by f.serviceTicket.branch.name
        """)
    List<FeedbackBranchAggregate> aggregateByBranch(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
