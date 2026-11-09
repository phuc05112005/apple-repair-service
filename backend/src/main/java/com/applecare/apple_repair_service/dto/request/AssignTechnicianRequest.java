package com.applecare.apple_repair_service.dto.request;

import com.applecare.apple_repair_service.enums.AssignmentSource;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AssignTechnicianRequest(
        @NotNull @Positive Long technicianId,
        @NotNull @Positive Long assignedByUserId,
        @NotNull AssignmentSource source,
        Integer predictedDurationMinutes // <--- THÊM TRƯỜNG NÀY ĐỂ NHẬN SỐ PHÚT DỰ ĐOÁN TỪ FRONTEND
) {
    public AssignTechnicianRequest(Long technicianId, Long assignedByUserId, AssignmentSource source) {
        this(technicianId, assignedByUserId, source, null);
    }
}