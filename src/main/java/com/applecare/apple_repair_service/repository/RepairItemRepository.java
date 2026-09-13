package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.RepairItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RepairItemRepository extends JpaRepository<RepairItem, Long> {

    List<RepairItem> findAllByServiceTicket_Id(Long serviceTicketId);
}
