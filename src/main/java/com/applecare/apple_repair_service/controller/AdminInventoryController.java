package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

import com.applecare.apple_repair_service.dto.command.*;
import com.applecare.apple_repair_service.security.CurrentActor;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminInventoryController {
    private final InventoryService inventory;
    private final CurrentActor actor;

    @GetMapping("/internal/inventory")
    public BranchInventoryResponse inventory(@RequestParam @Positive Long branchId, @RequestParam @Positive Long partId) {
        return inventory.getInventory(branchId, partId);
    }
    @GetMapping("/admin/inventory")
    public List<BranchInventoryResponse> inventories(
            @RequestParam(required = false) @Positive Long branchId,
            @RequestParam(required = false) @Positive Long partId) {
        return inventory.listInventories(branchId, partId);
    }
    @GetMapping("/admin/parts/{partId}/inventory-transactions")
    public List<InventoryTransactionResponse> transactionHistory(@PathVariable @Positive Long partId) {
        return inventory.getTransactionHistory(partId);
    }
    @PostMapping("/admin/inventory/stock-in")
    public BranchInventoryResponse stockIn(@Valid @RequestBody StockAdjustmentCommand request) {
        return inventory.stockIn(new StockAdjustmentRequest(request.branchId(),request.partId(),request.quantity(),actor.id(),request.note()));
    }
    @PostMapping("/admin/inventory/stock-out")
    public BranchInventoryResponse stockOut(@Valid @RequestBody StockAdjustmentCommand request) {
        return inventory.stockOut(new StockAdjustmentRequest(request.branchId(),request.partId(),request.quantity(),actor.id(),request.note()));
    }
    @PostMapping("/admin/inventory/transfer")
    public InventoryTransactionResponse transfer(@Valid @RequestBody StockTransferCommand request) {
        return inventory.transferStock(new TransferStockRequest(request.partId(),request.sourceBranchId(),
                request.destinationBranchId(),request.quantity(),actor.id(),request.note()));
    }
}
