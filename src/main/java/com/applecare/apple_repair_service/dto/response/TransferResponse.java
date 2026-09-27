package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.TransferMode;
import com.applecare.apple_repair_service.enums.TransferStatus;

import java.time.LocalDateTime;

public record TransferResponse(
        Long id,
        Long fromAssignmentId,
        Long ticketId,
        Long fromTechnicianId,
        String fromTechnicianName,
        Long targetTechnicianId,
        String targetTechnicianName,
        TransferMode mode,
        TransferStatus status,
        Long requestedById,
        Long respondedById,
        String note,
        String workDone,
        String currentCondition,
        String responseNote,
        LocalDateTime requestedAt,
        LocalDateTime respondedAt
) {
}
