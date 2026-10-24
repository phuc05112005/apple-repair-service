package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.AssignmentSource;
import com.applecare.apple_repair_service.enums.AssignmentStatus;

import java.time.LocalDateTime;

public record AssignmentResponse(
        Long id,
        Long serviceTicketId,
        Long technicianId,
        String technicianName,
        Long assignedById,
        AssignmentSource source,
        AssignmentStatus status,
        LocalDateTime assignedAt,
        LocalDateTime endedAt,
        String note
) {
}
