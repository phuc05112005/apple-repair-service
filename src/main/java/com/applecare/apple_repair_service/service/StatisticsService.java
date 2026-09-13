package com.applecare.apple_repair_service.service;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.DeviceType;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.repository.ServiceTicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.EnumMap;
@Service
@RequiredArgsConstructor
@Transactional(readOnly=true)
public class StatisticsService {
    private final ServiceTicketRepository tickets;
    private final DomainAccess access;
    public StatisticsOverviewResponse overview(LocalDate from, LocalDate to, Long branchId, Long deviceTypeId) {
        BusinessRules.require(from != null && to != null && !from.isAfter(to) && !to.equals(LocalDate.MAX), "Invalid statistics date range");
        if (branchId != null) access.get(Branch.class, branchId);
        if (deviceTypeId != null) access.get(DeviceType.class, deviceTypeId);
        var start=from.atStartOfDay();
        var end=to.plusDays(1).atStartOfDay();
        var counts=new EnumMap<ServiceTicketStatus,Long>(ServiceTicketStatus.class);
        tickets.countCurrentStatuses(start,end,branchId,deviceTypeId).forEach(c->counts.put(c.status(),c.count()));
        var statuses=Arrays.stream(ServiceTicketStatus.values()).map(status->new StatusCountResponse(status,counts.getOrDefault(status,0L))).toList();
        return new StatisticsOverviewResponse(from,to,branchId,deviceTypeId,statuses.stream().mapToLong(StatusCountResponse::count).sum(),statuses,
            tickets.sumPaidRevenue(start,end,branchId,deviceTypeId).setScale(2,RoundingMode.HALF_UP),
            tickets.countWarrantyReturnTickets(start,end,branchId,deviceTypeId));
    }
}

