package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.Assignment;
import com.applecare.apple_repair_service.enums.AssignmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {

    Optional<Assignment> findFirstByServiceTicket_IdAndStatus(
            Long serviceTicketId, AssignmentStatus status);

    List<Assignment> findAllByServiceTicket_IdOrderByAssignedAtAsc(Long serviceTicketId);

    List<Assignment> findAllByTechnician_IdAndStatus(Long technicianId, AssignmentStatus status);

    List<Assignment> findAllByTechnician_IdAndStatusOrderByAssignedAtAsc(Long technicianId, AssignmentStatus status);
}
