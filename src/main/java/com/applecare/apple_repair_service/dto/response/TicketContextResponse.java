package com.applecare.apple_repair_service.dto.response;

import java.util.List;

public record TicketContextResponse(
        Long customerId,
        String customerFullName,
        String customerPhone,
        Long customerDeviceId,
        Long deviceModelId,
        String deviceModelName,
        String deviceTypeName,
        String serialNumber,
        String storage,
        String symptomDescription,
        Long branchId,
        String branchName,
        List<String> serviceIssues,
        List<String> requestedServices
) {
}
