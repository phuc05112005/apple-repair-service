package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDateTime;

public record CustomerFeedbackResponse(
        Long id,
        Long ticketId,
        String ticketCode,
        String customerName,
        String customerPhone,
        String deviceModelName,
        String branchName,
        Boolean satisfied,
        String comment,
        LocalDateTime createdAt
) {}