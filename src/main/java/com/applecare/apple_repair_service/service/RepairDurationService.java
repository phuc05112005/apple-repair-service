package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.entity.ServiceStatusHistory;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.repository.ServiceStatusHistoryRepository;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RepairDurationService {
    private final ServiceStatusHistoryRepository histories;
    private final DomainAccess access;
    private final Clock clock;

    public long calculateCompletedRepairMinutes(Long id) {
        access.get(ServiceTicket.class, id);
        return calculate(histories.findAllByServiceTicket_IdOrderByChangedAtAsc(id), null);
    }

    public long calculateCurrentRepairMinutes(Long id) {
        access.get(ServiceTicket.class, id);
        return calculate(histories.findAllByServiceTicket_IdOrderByChangedAtAsc(id), LocalDateTime.now(clock));
    }

    long calculate(List<ServiceStatusHistory> input, LocalDateTime now) {
        var records = new ArrayList<>(input);
        for (var record : records)
            BusinessRules.require(record != null && record.getChangedAt() != null && record.getToStatus() != null, "Incomplete status history");
        records.sort(Comparator.comparing(ServiceStatusHistory::getChangedAt).thenComparing(ServiceStatusHistory::getId, Comparator.nullsFirst(Comparator.naturalOrder())));
        LocalDateTime start = null, previousTime = null;
        ServiceTicketStatus previous = null;
        Duration total = Duration.ZERO;
        for (var h : records) {
            BusinessRules.require(h.getFromStatus() == previous, "Discontinuous status history");
            BusinessRules.require(previousTime == null || !h.getChangedAt().isBefore(previousTime), "Invalid history time order");
            BusinessRules.require(h.getFromStatus() != h.getToStatus(), "Repeated history state");
            if (h.getFromStatus() == ServiceTicketStatus.REPAIRING) {
                BusinessRules.require(start != null, "Missing repair interval start");
                total = total.plus(Duration.between(start, h.getChangedAt()));
                start = null;
            }
            if (h.getToStatus() == ServiceTicketStatus.REPAIRING) start = h.getChangedAt();
            previous = h.getToStatus();
            previousTime = h.getChangedAt();
        }
        if (start != null && now != null) {
            BusinessRules.require(!now.isBefore(start), "Clock is before repair start");
            total = total.plus(Duration.between(start, now));
        }
        return total.toMinutes();
    }
}
