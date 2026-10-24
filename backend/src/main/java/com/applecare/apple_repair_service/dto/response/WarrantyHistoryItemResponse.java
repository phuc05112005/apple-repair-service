package com.applecare.apple_repair_service.dto.response;

import com.applecare.apple_repair_service.enums.ServiceTypeCode;
import com.applecare.apple_repair_service.enums.WarrantyRemedy;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record WarrantyHistoryItemResponse(
        Long repairItemId, Long ticketId, String ticketCode,
        Long customerDeviceId, Long deviceTypeId, String deviceTypeName,
        Long deviceModelId, String deviceModelName, String serviceName,
        ServiceTypeCode originalServiceType, WarrantyRemedy warrantyTechnicalMethod,
        LocalDateTime completedAt, LocalDateTime handedOverAt,
        LocalDate warrantyStartDate, LocalDate warrantyEndDate, boolean eligible,
        long claimCount, LocalDateTime lastClaimAt, List<WarrantyClaimSummaryResponse> claims
) {}
