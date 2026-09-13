package com.applecare.apple_repair_service.dto.response;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
public record StatisticsOverviewResponse(LocalDate from, LocalDate to, Long branchId, Long deviceTypeId,
        long totalTickets, List<StatusCountResponse> currentStatusCounts, BigDecimal paidRevenue, long warrantyReturnTickets) {}

