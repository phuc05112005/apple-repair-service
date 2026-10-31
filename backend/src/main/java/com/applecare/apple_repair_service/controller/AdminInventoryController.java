package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.request.*;
import com.applecare.apple_repair_service.dto.response.*;
import com.applecare.apple_repair_service.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.time.LocalDate;
import com.applecare.apple_repair_service.enums.InventoryTransactionType;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.multipart.MultipartFile;

import com.applecare.apple_repair_service.dto.command.*;
import com.applecare.apple_repair_service.security.CurrentActor;

@RestController
@RequestMapping("/api/v1")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminInventoryController {
    private final InventoryService inventory;
    private final InventoryExcelService inventoryExcel;
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

    @GetMapping("/admin/inventory/transactions")
    public Page<InventoryTransactionResponse> transactions(
            @RequestParam(required = false) @Positive Long branchId,
            @RequestParam(required = false) @Positive Long partId,
            @RequestParam(required = false) InventoryTransactionType transactionType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String code,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return inventory.searchTransactions(branchId, partId, transactionType, from, to, code, pageable);
    }

    @GetMapping("/admin/inventory/import-template")
    public ResponseEntity<byte[]> importTemplate() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=inventory-stock-in-template.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(inventoryExcel.createTemplate());
    }

    @PostMapping(value = "/admin/inventory/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public InventoryImportResultResponse importInventory(@RequestPart("file") MultipartFile file) {
        return inventoryExcel.importWorkbook(file, actor.id());
    }

    @GetMapping("/admin/inventory/lots")
    public List<InventoryLotResponse> lots(@RequestParam(required = false) @Positive Long branchId,
                                           @RequestParam(required = false) @Positive Long partId) {
        return inventory.listLots(branchId, partId);
    }

    @PostMapping("/admin/inventory/stock-in")
    public StockInResponse stockIn(@Valid @RequestBody StockInCommand request) {
        return inventory.stockIn(new StockInRequest(
                request.lotCode(),
                request.branchId(),
                request.partId(),
                request.quantity(),
                request.supplierName(),
                request.costPrice(),
                request.receivedAt(),
                actor.id(),
                request.sourceNote()
        ));
    }

    @PostMapping("/admin/inventory/stock-out")
    public BranchInventoryResponse stockOut(@Valid @RequestBody StockAdjustmentCommand request) {
        return inventory.stockOut(new StockAdjustmentRequest(request.branchId(), request.partId(), request.quantity(), actor.id(), request.note()));
    }

    @PostMapping("/admin/inventory/transfer")
    public InventoryTransactionResponse transfer(@Valid @RequestBody StockTransferCommand request) {
        return inventory.transferStock(new TransferStockRequest(request.partId(), request.sourceBranchId(),
                request.destinationBranchId(), request.quantity(), actor.id(), request.note()));
    }
}