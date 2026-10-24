package com.applecare.apple_repair_service.dto.response;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
public record StatusCountResponse(ServiceTicketStatus status, long count) {}

