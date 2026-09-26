package com.applecare.apple_repair_service.dto.response;
public record StockInResponse(InventoryLotResponse lot, BranchInventoryResponse inventory,
                              InventoryTransactionResponse transaction) {}
