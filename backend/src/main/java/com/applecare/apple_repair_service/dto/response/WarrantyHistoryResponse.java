package com.applecare.apple_repair_service.dto.response;

import java.util.List;

public record WarrantyHistoryResponse(
        Long customerId, String customerFullName, String customerPhone,
        List<WarrantyHistoryItemResponse> items
) {}
