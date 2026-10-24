package com.applecare.apple_repair_service.dto.response;

import java.util.List;

public record InventoryImportResultResponse(int importedRows, List<String> transactionCodes) {
}
