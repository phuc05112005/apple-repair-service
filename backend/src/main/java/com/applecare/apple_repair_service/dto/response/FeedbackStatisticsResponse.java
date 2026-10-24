package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDate;
import java.util.List;

public record FeedbackStatisticsResponse(
        LocalDate from,
        LocalDate to,
        long total,
        long satisfied,
        long dissatisfied,
        double satisfactionRate,
        List<FeedbackBranchStatisticsResponse> branches) {
    public FeedbackStatisticsResponse(LocalDate from, LocalDate to, long total, long satisfied,
                                      long dissatisfied, double satisfactionRate) {
        this(from, to, total, satisfied, dissatisfied, satisfactionRate, List.of());
    }
}
