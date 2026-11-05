package com.applecare.apple_repair_service.dto.response;

public record PublicTechnicianResponse(
        Long technicianId,
        String name,
        String phone,
        String assignmentStatus
) {}