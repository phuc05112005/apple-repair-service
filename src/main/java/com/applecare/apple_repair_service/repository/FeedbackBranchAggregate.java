package com.applecare.apple_repair_service.repository;

public interface FeedbackBranchAggregate {
    Long getBranchId();
    String getBranchName();
    Long getTotal();
    Long getSatisfied();
}
