package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.Assignment;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {
 @org.springframework.data.jpa.repository.Query("select a from Assignment a join fetch a.serviceTicket t join fetch t.branch join fetch a.technician where a.status=com.applecare.apple_repair_service.enums.AssignmentStatus.ACTIVE order by a.assignedAt,a.id")
 List<Assignment> findTimingAssignments();
 @org.springframework.data.jpa.repository.Query("select a.technician.id,max(t.actualRepairCompletedAt) from Assignment a join a.serviceTicket t where t.actualRepairCompletedAt is not null and a.endedAt=t.actualRepairCompletedAt group by a.technician.id")
 List<Object[]> latestTechnicalCompletions();


    Optional<Assignment> findFirstByServiceTicket_IdAndStatus(
            Long serviceTicketId, AssignmentStatus status);

    List<Assignment> findAllByServiceTicket_IdOrderByAssignedAtAsc(Long serviceTicketId);

    List<Assignment> findAllByTechnician_IdAndStatus(Long technicianId, AssignmentStatus status);

    @org.springframework.data.jpa.repository.Query("select count(a)>0 from Assignment a where a.technician.id=:technicianId and a.status=com.applecare.apple_repair_service.enums.AssignmentStatus.ACTIVE and a.serviceTicket.status in (com.applecare.apple_repair_service.enums.ServiceTicketStatus.INSPECTING,com.applecare.apple_repair_service.enums.ServiceTicketStatus.REPAIRING) and a.serviceTicket.id<>:ticketId")
    boolean hasOtherActiveTechnicalWork(Long technicianId, Long ticketId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths={"serviceTicket.customerDevice.customer","serviceTicket.customerDevice.deviceModel","serviceTicket.branch","technician"})
    List<Assignment> findAllByTechnician_IdAndStatusOrderByAssignedAtAsc(Long technicianId, AssignmentStatus status);
}
