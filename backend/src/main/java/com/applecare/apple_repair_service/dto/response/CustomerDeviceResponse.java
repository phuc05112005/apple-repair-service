package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDateTime;

public record CustomerDeviceResponse(
        Long id,
        Long customerId,
        Long deviceModelId,
        String serialNumber,
        String storage,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
