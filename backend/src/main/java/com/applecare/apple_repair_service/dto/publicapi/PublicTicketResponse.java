package com.applecare.apple_repair_service.dto.publicapi;

public record PublicTicketResponse(String ticketCode, String deviceModelName, String branchName, com.applecare.apple_repair_service.enums.ServiceTicketStatus status, com.applecare.apple_repair_service.enums.PaymentStatus paymentStatus, java.math.BigDecimal approvedTotal, java.time.LocalDateTime receivedAt, java.time.LocalDateTime actualRepairStartedAt, java.time.LocalDateTime estimatedCompletionAt, Long estimatedDurationMinutes, java.time.LocalDateTime handedOverAt, java.util.List<PublicRepairItemResponse> repairItems) {
}
