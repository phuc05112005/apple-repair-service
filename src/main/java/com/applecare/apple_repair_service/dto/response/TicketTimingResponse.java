package com.applecare.apple_repair_service.dto.response;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.enums.EstimateSource;
import java.time.LocalDateTime;
public record TicketTimingResponse(LocalDateTime assignmentDueAt,LocalDateTime initialEstimatedStartAt,LocalDateTime estimatedStartAt,
 LocalDateTime initialEstimatedCompletionAt,LocalDateTime estimatedCompletionAt,Long estimatedDurationMinutes,
 LocalDateTime actualRepairStartedAt,LocalDateTime actualRepairCompletedAt,EstimateSource estimateSource) {
 public static TicketTimingResponse from(ServiceTicket t){return new TicketTimingResponse(t.getAssignmentDueAt(),t.getInitialEstimatedStartAt(),t.getEstimatedStartAt(),t.getInitialEstimatedCompletionAt(),t.getEstimatedCompletionAt(),t.getEstimatedDurationMinutes(),t.getActualRepairStartedAt(),t.getActualRepairCompletedAt(),t.getEstimateSource());}
}
