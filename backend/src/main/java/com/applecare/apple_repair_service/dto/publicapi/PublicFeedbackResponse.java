package com.applecare.apple_repair_service.dto.publicapi;

public record PublicFeedbackResponse(String ticketCode, boolean satisfied, String comment) {
}
