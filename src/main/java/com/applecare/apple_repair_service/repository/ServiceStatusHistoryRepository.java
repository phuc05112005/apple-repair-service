package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.ServiceStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServiceStatusHistoryRepository extends JpaRepository<ServiceStatusHistory, Long> {
 @org.springframework.data.jpa.repository.Query("select h from ServiceStatusHistory h where h.serviceTicket.id in :ids order by h.changedAt,h.id")
 java.util.List<ServiceStatusHistory> findTimingHistories(java.util.Collection<Long> ids);


    List<ServiceStatusHistory> findAllByServiceTicket_IdOrderByChangedAtAsc(Long serviceTicketId);
}
