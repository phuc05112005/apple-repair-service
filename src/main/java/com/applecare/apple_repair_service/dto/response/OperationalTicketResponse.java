package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ServiceTicketStatus;

import java.time.LocalDateTime;
import java.util.List;

public record OperationalTicketResponse(
        Long ticketId,
        String ticketCode,
        String customerFullName,
        String customerPhone,
        Long customerDeviceId,
        Long deviceModelId,
        String deviceModelName,
        List<String> serviceIssues,
        List<String> requestedServices,
        Long branchId,
        String branchName,
        ServiceTicketStatus status,
        LocalDateTime receivedAt,
        long estimatedDurationMinutes,
        Long activeAssignmentId,
        Long activeTechnicianId,
        String activeTechnicianName, LocalDateTime assignedAt, TicketTimingResponse timing
) {
}
