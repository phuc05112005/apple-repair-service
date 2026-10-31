package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.ReversePartUsageRequest;
import com.applecare.apple_repair_service.dto.request.StockAdjustmentRequest;
import com.applecare.apple_repair_service.dto.request.StockInRequest;
import com.applecare.apple_repair_service.dto.request.TransferStockRequest;
import com.applecare.apple_repair_service.dto.request.UsePartRequest;
import com.applecare.apple_repair_service.dto.response.BranchInventoryResponse;
import com.applecare.apple_repair_service.dto.response.InventoryTransactionResponse;
import com.applecare.apple_repair_service.dto.response.InventoryLotResponse;
import com.applecare.apple_repair_service.dto.response.StockInResponse;
import com.applecare.apple_repair_service.dto.response.PartUsageResponse;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.BranchInventory;
import com.applecare.apple_repair_service.entity.InventoryTransaction;
import com.applecare.apple_repair_service.entity.InventoryLot;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.entity.PartUsage;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.InventoryTransactionType;
import com.applecare.apple_repair_service.enums.PartUsageStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.exception.InsufficientStockException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.BranchInventoryRepository;
import com.applecare.apple_repair_service.repository.InventoryTransactionRepository;
import com.applecare.apple_repair_service.repository.InventoryLotRepository;
import com.applecare.apple_repair_service.repository.PartUsageRepository;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InventoryService {
    private final BranchInventoryRepository inventory;
    private final PartUsageRepository usages;
    private final InventoryTransactionRepository transactions;
    private final InventoryLotRepository lots;
    private final DomainAccess access;
    private final BusinessRules rules;
    private final EntityResponses mapper;
    private final Clock clock;
    private final DefectiveInventoryService defectiveInventory;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public StockInResponse stockIn(StockInRequest r) {
        rules.validate(r);
        BusinessRules.require(!r.receivedAt().isAfter(LocalDateTime.now(clock)), "Thời điểm nhận kho không được ở tương lai.");
        var code = r.lotCode().trim();
        if (lots.existsByLotCodeIgnoreCase(code)) throw new ConflictException("Mã nhập kho tham chiếu đã tồn tại.");
        var part = lockPart(r.partId());
        var branch = branch(r.branchId());
        var actor = access.get(User.class, r.receivedByUserId());
        var lot = new InventoryLot();
        lot.setLotCode(code);
        lot.setBranch(branch);
        lot.setPart(part);
        lot.setReceivedQuantity(r.quantity());
        lot.setReceivedAt(r.receivedAt());
        lot.setReceivedBy(actor);
        lot.setSourceNote(BusinessRules.text(r.sourceNote()));
        lots.saveAndFlush(lot);
        var stock = lockedStock(branch, part);
        increase(stock, r.quantity());
        var movement = movement(part, InventoryTransactionType.STOCK_IN, null, branch, r.quantity(), r.supplierName(), r.costPrice(), null, lot, actor, r.sourceNote());
        return new StockInResponse(mapper.map(lot), mapper.map(stock), mapper.map(movement));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BranchInventoryResponse stockIn(StockAdjustmentRequest r) {
        var result = stockIn(new StockInRequest("TEST-" + java.util.UUID.randomUUID(), r.branchId(), r.partId(),
                r.quantity(), LocalDateTime.now(clock), r.recordedByUserId(), r.note()));
        return result.inventory();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BranchInventoryResponse stockOut(StockAdjustmentRequest r) {
        rules.validate(r);
        var part = lockPart(r.partId());
        var branch = branch(r.branchId());
        var actor = access.get(User.class, r.recordedByUserId());
        var stock = lockedStock(branch, part);
        decrease(stock, r.quantity());
        movement(part, InventoryTransactionType.STOCK_OUT, branch, null, r.quantity(), null, null, null, null, actor, r.note());
        return mapper.map(stock);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PartUsageResponse usePart(UsePartRequest r) {
        rules.validate(r);
        var item = access.get(RepairItem.class, r.repairItemId());
        var ticket = access.lock(ServiceTicket.class, item.getServiceTicket().getId());
        item = access.lock(RepairItem.class, r.repairItemId());
        BusinessRules.require(item.getApprovalStatus() == ApprovalStatus.APPROVED, "Part usage requires approved repair item");
        BusinessRules.require(ticket.getStatus() == ServiceTicketStatus.REPAIRING || ticket.getStatus() == ServiceTicketStatus.WAITING_PART, "Part usage requires an ongoing repair");
        var part = lockPart(r.partId());
        var branch = branch(ticket.getBranch().getId());
        if (item.getWarrantySourceItem() == null
                && item.getServiceCatalogItem().getServiceType().getCode() == com.applecare.apple_repair_service.enums.ServiceTypeCode.REPLACEMENT) {
            var expected = item.getServiceCatalogItem().getPart();
            BusinessRules.require(expected != null && expected.getId().equals(part.getId()),
                    "Linh kiện sử dụng phải khớp với phương án thay thế đã được duyệt.");
        }
        boolean warrantyReplacement = item.getWarrantyRemedy() == com.applecare.apple_repair_service.enums.WarrantyRemedy.REPLACEMENT;
        if (item.getWarrantySourceItem() != null) {
            BusinessRules.require(item.getWarrantyDecision() == com.applecare.apple_repair_service.enums.WarrantyDecision.APPROVED && warrantyReplacement,
                    "Ghi nhận phương án thay bảo hành trước khi xuất linh kiện; dịch vụ trả phí cần hạng mục riêng.");
            var warrantyCatalog = item.getWarrantyReplacementCatalog() != null
                    ? item.getWarrantyReplacementCatalog() : item.getServiceCatalogItem();
            BusinessRules.require(warrantyCatalog.getPart() != null && warrantyCatalog.getPart().getId().equals(part.getId()),
                    "Linh kiện phải đúng phương án thay bảo hành.");
            BusinessRules.required(r.defectiveReturnNote(), "Nhập mô tả linh kiện lỗi thu hồi (không nhập lại kho sử dụng)");
        } else if (BusinessRules.text(r.defectiveReturnNote()) != null)
            BusinessRules.require(item.getServiceCatalogItem().getServiceType().getCode() == com.applecare.apple_repair_service.enums.ServiceTypeCode.REPLACEMENT,
                    "Thu hồi linh kiện gắn với hạng mục thay thế.");
        var actor = access.get(User.class, r.recordedByUserId());
        var stock = lockedStock(branch, part);
        decrease(stock, r.quantity());
        var usage = new PartUsage();
        usage.setRepairItem(item);
        usage.setPart(part);
        usage.setQuantity(r.quantity());
        usage.setRecordedBy(actor);
        usage.setUsedAt(LocalDateTime.now(clock));
        usage.setDefectiveReturnNote(BusinessRules.text(r.defectiveReturnNote()));
        usages.saveAndFlush(usage);
        movement(part, InventoryTransactionType.USAGE_OUT, branch, null, r.quantity(), null, null, usage, null, actor, null);
        if (usage.getDefectiveReturnNote() != null) {
            var original = item.getWarrantySourceItem() == null ? null : item.getWarrantySourceItem().getServiceCatalogItem().getPart();
            var removed = r.defectivePartId() != null ? access.get(Part.class,r.defectivePartId()) : original != null ? original : part;
            defectiveInventory.record(usage, removed, usage.getDefectiveReturnNote());
        }
        return mapper.map(usage);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PartUsageResponse reversePartUsage(ReversePartUsageRequest r) {
        rules.validate(r);
        var initial = access.get(PartUsage.class, r.partUsageId());
        access.lock(ServiceTicket.class, initial.getRepairItem().getServiceTicket().getId());
        var usage = access.lock(PartUsage.class, r.partUsageId());
        if (usage.getStatus() != PartUsageStatus.ACTIVE) throw new ConflictException("Part usage already reversed");
        BusinessRules.require(usage.getDefectiveReturnNote() == null,
                "Đã ghi nhận thay bảo hành và thu hồi linh kiện lỗi. Không thể hoàn linh kiện lỗi vào kho sử dụng.");
        var part = access.lock(Part.class, usage.getPart().getId());
        var branch = access.get(Branch.class, usage.getRepairItem().getServiceTicket().getBranch().getId());
        var actor = access.get(User.class, r.reversedByUserId());
        var stock = lockedStock(branch, part);
        increase(stock, usage.getQuantity());
        usage.setStatus(PartUsageStatus.REVERSED);
        usage.setReversedBy(actor);
        usage.setReversedAt(LocalDateTime.now(clock));
        usage.setReversalNote(BusinessRules.text(r.reversalNote()));
        movement(part, InventoryTransactionType.USAGE_RETURN, null, branch, usage.getQuantity(), null, null, usage, null, actor, r.reversalNote());
        return mapper.map(usage);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InventoryTransactionResponse transferStock(TransferStockRequest r) {
        rules.validate(r);
        BusinessRules.require(!r.sourceBranchId().equals(r.destinationBranchId()), "Source and destination must differ");
        var part = lockPart(r.partId());
        var source = branch(r.sourceBranchId());
        var destination = branch(r.destinationBranchId());
        var actor = access.get(User.class, r.recordedByUserId());
        BranchInventory from, to;
        if (source.getId() < destination.getId()) {
            from = lockedStock(source, part);
            to = lockedStock(destination, part);
        } else {
            to = lockedStock(destination, part);
            from = lockedStock(source, part);
        }
        decrease(from, r.quantity());
        increase(to, r.quantity());
        return mapper.map(movement(part, InventoryTransactionType.TRANSFER, source, destination, r.quantity(), null, null, null, null, actor, r.note()));
    }

    public BranchInventoryResponse getInventory(Long branchId, Long partId) {
        access.get(Branch.class, branchId);
        access.get(Part.class, partId);
        return inventory.findByBranch_IdAndPart_Id(branchId, partId).map(mapper::map)
                .orElseGet(() -> new BranchInventoryResponse(null, branchId, partId, 0, null, null));
    }

    public List<BranchInventoryResponse> listInventories(Long branchId, Long partId) {
        if (branchId != null) access.get(Branch.class, branchId);
        if (partId != null) access.get(Part.class, partId);
        return inventory.findForAdmin(branchId, partId).stream().map(mapper::map).toList();
    }

    public List<InventoryTransactionResponse> getTransactionHistory(Long partId) {
        access.get(Part.class, partId);
        return transactions.findAllByPart_IdOrderByCreatedAtDesc(partId).stream().map(mapper::map).toList();
    }

    public Page<InventoryTransactionResponse> searchTransactions(Long branchId, Long partId,
                                                                 InventoryTransactionType type, LocalDate from, LocalDate to, String code,
                                                                 Pageable pageable) {
        if (branchId != null) access.get(Branch.class, branchId);
        if (partId != null) access.get(Part.class, partId);
        BusinessRules.require(from == null || to == null || !from.isAfter(to),
                "Ngày bắt đầu không được sau ngày kết thúc.");
        LocalDateTime fromTime = from == null ? null : from.atStartOfDay();
        LocalDateTime toTime = to == null ? null : to.plusDays(1).atStartOfDay();
        String query = BusinessRules.text(code);

        return transactions.search(branchId, partId, type, fromTime, toTime, query, pageable)
                .map(mapper::map);
    }

    public List<InventoryLotResponse> listLots(Long branchId, Long partId) {
        if (branchId != null) access.get(Branch.class, branchId);
        if (partId != null) access.get(Part.class, partId);
        return lots.search(branchId, partId).stream().map(mapper::map).toList();
    }

    private Branch branch(Long id) {
        var b = access.get(Branch.class, id);
        BusinessRules.require(b.getStatus() == ActiveStatus.ACTIVE, "Branch is inactive");
        return b;
    }

    private Part lockPart(Long id) {
        var p = access.lock(Part.class, id);
        BusinessRules.require(p.getStatus() == ActiveStatus.ACTIVE, "Part is inactive");
        return p;
    }

    private BranchInventory lockedStock(Branch branch, Part part) {
        return inventory.findByBranchPartForUpdate(branch.getId(), part.getId()).orElseGet(() -> {
            var stock = new BranchInventory();
            stock.setBranch(branch);
            stock.setPart(part);
            return inventory.saveAndFlush(stock);
        });
    }

    private void increase(BranchInventory stock, int amount) {
        try {
            stock.setQuantity(Math.addExact(stock.getQuantity(), amount));
        } catch (ArithmeticException ex) {
            throw new BusinessRuleViolationException("Stock quantity exceeds integer range");
        }
    }

    private void decrease(BranchInventory stock, int amount) {
        if (stock.getQuantity() < amount) throw new InsufficientStockException("Insufficient stock");
        stock.setQuantity(stock.getQuantity() - amount);
    }

    private InventoryTransaction movement(Part part, InventoryTransactionType type, Branch source, Branch destination,
                                          int quantity, String supplierName, BigDecimal costPrice,
                                          PartUsage usage, InventoryLot lot, User actor, String note) {
        var tx = new InventoryTransaction();
        tx.setPart(part);
        tx.setTransactionType(type);
        tx.setSourceBranch(source);
        tx.setDestinationBranch(destination);
        tx.setQuantity(quantity);
        tx.setSupplierName(supplierName);
        tx.setCostPrice(costPrice);
        tx.setPartUsage(usage);
        tx.setInventoryLot(lot);
        tx.setRecordedBy(actor);
        tx.setNote(BusinessRules.text(note));
        tx.setCreatedAt(LocalDateTime.now(clock));
        return transactions.saveAndFlush(tx);
    }
}