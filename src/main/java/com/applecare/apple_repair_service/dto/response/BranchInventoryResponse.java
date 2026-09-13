package com.applecare.apple_repair_service.dto.response;

import java.time.LocalDateTime;

public record BranchInventoryResponse(
        Long id,
        Long branchId,
        Long partId,
        Integer quantity,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
