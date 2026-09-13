package com.applecare.apple_repair_service.repository;

import com.applecare.apple_repair_service.entity.Transfer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TransferRepository extends JpaRepository<Transfer, Long> {

    List<Transfer> findAllByFromAssignment_ServiceTicket_IdOrderByRequestedAtDesc(
            Long serviceTicketId);
}
