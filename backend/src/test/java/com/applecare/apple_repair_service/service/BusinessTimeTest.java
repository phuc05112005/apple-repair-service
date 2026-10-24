package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.config.TimeConfig;
import com.applecare.apple_repair_service.entity.ServiceStatusHistory;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.repository.ServiceStatusHistoryRepository;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class BusinessTimeTest {
    @Test void vietnamBusinessDayChangesAtLocalMidnightNotUtcMidnight() {
        var before = Clock.fixed(Instant.parse("2026-09-20T16:59:59Z"), TimeConfig.BUSINESS_ZONE);
        var after = Clock.offset(before, Duration.ofSeconds(1));
        assertEquals(LocalDate.of(2026, 9, 20), LocalDate.now(before));
        assertEquals(LocalDate.of(2026, 9, 21), LocalDate.now(after));
        assertEquals(LocalDateTime.of(2026, 9, 21, 0, 0), LocalDateTime.now(after));
        assertEquals(TimeConfig.BUSINESS_ZONE, new TimeConfig().clock().getZone());
    }

    @Test void repairIntervalsCrossingMidnightExcludeWaitingWithoutDoubleCounting() {
        var start = LocalDateTime.of(2026, 9, 20, 23, 40);
        var repairing = event(null, ServiceTicketStatus.REPAIRING, start);
        var waiting = event(ServiceTicketStatus.REPAIRING, ServiceTicketStatus.WAITING_PART, start.plusMinutes(20));
        var resumed = event(ServiceTicketStatus.WAITING_PART, ServiceTicketStatus.REPAIRING, start.plusMinutes(60));
        var history = List.of(repairing, waiting, resumed);
        var service = new RepairDurationService(mock(ServiceStatusHistoryRepository.class), mock(DomainAccess.class), TestData.CLOCK);
        assertEquals(20, service.calculate(history, null));
        assertEquals(25, service.calculate(history, start.plusMinutes(65)));
    }

    private ServiceStatusHistory event(ServiceTicketStatus from, ServiceTicketStatus to, LocalDateTime at) {
        var h = new ServiceStatusHistory(); h.setFromStatus(from); h.setToStatus(to); h.setChangedAt(at); return h;
    }
}
