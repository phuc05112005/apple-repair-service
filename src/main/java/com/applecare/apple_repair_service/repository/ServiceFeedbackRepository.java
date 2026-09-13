package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ServiceFeedbackRepository extends JpaRepository<ServiceFeedback, Long> {

    Optional<ServiceFeedback> findByServiceTicket_Id(Long serviceTicketId);
}
