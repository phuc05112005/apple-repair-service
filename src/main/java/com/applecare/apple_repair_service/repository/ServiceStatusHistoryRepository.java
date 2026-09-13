package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServiceStatusHistoryRepository extends JpaRepository<ServiceStatusHistory, Long> {

    List<ServiceStatusHistory> findAllByServiceTicket_IdOrderByChangedAtAsc(Long serviceTicketId);
}
