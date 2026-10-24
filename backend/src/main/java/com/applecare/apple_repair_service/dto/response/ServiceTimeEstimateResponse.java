package com.applecare.apple_repair_service.dto.response;
import com.applecare.apple_repair_service.enums.EstimateSource;
import java.time.LocalDateTime;
import java.math.BigDecimal;
public record ServiceTimeEstimateResponse(Long id,Long technicianId,LocalDateTime estimatedStartAt,LocalDateTime estimatedCompletionAt,Long estimatedDurationMinutes,EstimateSource estimateSource,String reason,int breakMinutesSnapshot,BigDecimal approvedPriceSnapshot,LocalDateTime createdAt,Long createdById) {}
