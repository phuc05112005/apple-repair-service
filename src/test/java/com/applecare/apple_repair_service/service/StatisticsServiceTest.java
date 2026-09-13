package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.dto.response.StatusCountResponse;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class StatisticsServiceTest {
    @Test void fillsMissingStatusesAndUsesInclusiveCalendarWindow() {
        var repository=mock(ServiceTicketRepository.class);
        var from=LocalDate.of(2026,9,1);var to=LocalDate.of(2026,9,11);
        when(repository.countCurrentStatuses(from.atStartOfDay(),to.plusDays(1).atStartOfDay(),null,null)).thenReturn(List.of(new StatusCountResponse(ServiceTicketStatus.REPAIRING,2)));
        when(repository.sumPaidRevenue(any(),any(),isNull(),isNull())).thenReturn(new BigDecimal("100"));
        var result=new StatisticsService(repository,mock(DomainAccess.class)).overview(from,to,null,null);
        assertEquals(2,result.totalTickets());assertEquals(9,result.currentStatusCounts().size());
        assertEquals(new BigDecimal("100.00"),result.paidRevenue());
        verify(repository).countWarrantyReturnTickets(from.atStartOfDay(),to.plusDays(1).atStartOfDay(),null,null);
    }
    @Test void rejectsReversedRangeBeforeQueries() {
        var repository=mock(ServiceTicketRepository.class);
        assertThrows(BusinessRuleViolationException.class,()->new StatisticsService(repository,mock(DomainAccess.class))
            .overview(LocalDate.of(2026,9,12),LocalDate.of(2026,9,11),null,null));
        verifyNoInteractions(repository);
    }
}

