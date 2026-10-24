package com.applecare.apple_repair_service.dto.response;

public record FeedbackBranchStatisticsResponse(
        Long branchId,
        String branchName,
        long total,
        long satisfied,
        long dissatisfied,
        double satisfactionRate) {}
