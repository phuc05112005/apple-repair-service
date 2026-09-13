package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDateTime;

public record TechnicianRecommendationResponse(Long technicianId, String technicianName, Long branchId,
                                               long estimatedWorkloadMinutes, long predictedNewJobMinutes,
                                               long remainingShiftMinutes, LocalDateTime estimatedAvailableAt,
                                               boolean eligible, String reason) {
}
