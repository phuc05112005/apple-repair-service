package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.PredictionSource;
import java.time.LocalDateTime;
import java.util.List;

public record TechnicianRecommendationResponse(Long technicianId, String technicianName, Long branchId,
                                               long estimatedWorkloadMinutes, long predictedNewJobMinutes,
                                               long remainingShiftMinutes, LocalDateTime estimatedAvailableAt,
                                               boolean eligible, String reason, int queuedJobs,
                                               double predictedTechnicalMinutes, PredictionSource predictionSource,
                                               List<String> predictionWarnings, LocalDateTime estimatedStartAt,
                                               LocalDateTime estimatedCompletionAt, String modelStatus,
                                               Boolean syntheticData, Boolean productionValidated) {
}
