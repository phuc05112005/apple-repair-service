package com.applecare.apple_repair_service.dto.response;

import java.math.BigDecimal;

public record AvailablePartResponse(
        Long partId,
        String partCode,
        String name,
        String brand,
        String variant,
        BigDecimal salePrice,
        Long branchId,
        Integer availableQuantity
) {
}
