package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDateTime;

public record ServiceFeedbackResponse(
        Long id,
        Long serviceTicketId,
        boolean satisfied,
        String comment,
        LocalDateTime createdAt
) {
}
