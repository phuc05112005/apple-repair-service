package com.applecare.apple_repair_service.dto.response;
import java.math.BigDecimal;
import java.util.Map;
public record TicketTimingMetricsResponse(Long assignmentWaitMinutes,Long queueWaitMinutes,Long startDelayMinutes,
 Long estimatedRepairMinutes,Long actualActiveRepairMinutes,Long initialCompletionDelayMinutes,Long currentEtaCompletionDelayMinutes,
 Long waitingPartMinutes,Long waitingApprovalMinutes,long transferCount,long servicePlanChangeCount,BigDecimal approvedPriceChange,
 Map<Long,Long> activeRepairMinutesByTechnician,boolean completeStatusHistory) {}
