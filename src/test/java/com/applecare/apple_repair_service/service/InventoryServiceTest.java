package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.ReversePartUsageRequest;
import com.applecare.apple_repair_service.dto.request.StockAdjustmentRequest;
import com.applecare.apple_repair_service.dto.request.TransferStockRequest;
import com.applecare.apple_repair_service.dto.request.UsePartRequest;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.BranchInventory;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.entity.PartUsage;
import com.applecare.apple_repair_service.entity.RepairItem;
import com.applecare.apple_repair_service.entity.ServiceTicket;
import com.applecare.apple_repair_service.entity.User;
import com.applecare.apple_repair_service.enums.ApprovalStatus;
import com.applecare.apple_repair_service.enums.InventoryTransactionType;
import com.applecare.apple_repair_service.enums.PartUsageStatus;
import com.applecare.apple_repair_service.enums.ServiceTicketStatus;
import com.applecare.apple_repair_service.exception.ConflictException;
import com.applecare.apple_repair_service.exception.InsufficientStockException;
import com.applecare.apple_repair_service.mapper.EntityResponses;
import com.applecare.apple_repair_service.repository.BranchInventoryRepository;
import com.applecare.apple_repair_service.repository.InventoryTransactionRepository;
import com.applecare.apple_repair_service.repository.InventoryLotRepository;
import com.applecare.apple_repair_service.repository.PartUsageRepository;
import jakarta.validation.Validation;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InventoryServiceTest {
    final BranchInventoryRepository inventory = mock(BranchInventoryRepository.class);
    final PartUsageRepository usages = mock(PartUsageRepository.class);
    final InventoryTransactionRepository transactions = mock(InventoryTransactionRepository.class);
    final InventoryLotRepository lots = mock(InventoryLotRepository.class);
    final DomainAccess access = mock(DomainAccess.class);
    final InventoryService service = new InventoryService(inventory, usages, transactions, lots, access, new BusinessRules(Validation.buildDefaultValidatorFactory().getValidator()), new EntityResponses(), TestData.CLOCK, mock(DefectiveInventoryService.class));
    final Part part = new Part();
    final BranchInventory stock = new BranchInventory();
    final Branch branch = TestData.branch(1);
    final ServiceTicket ticket = TestData.ticket(ServiceTicketStatus.REPAIRING);
    final RepairItem item = TestData.item(1, ticket, ApprovalStatus.APPROVED);
    PartUsage usage;

    @BeforeEach
    void setup() {
        part.setId(1L);
        stock.setBranch(branch);
        stock.setPart(part);
        stock.setQuantity(5);
        when(access.lock(Part.class, 1L)).thenReturn(part);
        when(access.get(Branch.class, 1L)).thenReturn(branch);
        when(access.get(User.class, 1L)).thenReturn(TestData.user(1));
        when(inventory.findByBranchPartForUpdate(1L, 1L)).thenReturn(Optional.of(stock));
        when(access.get(RepairItem.class, 1L)).thenReturn(item);
        when(access.lock(RepairItem.class, 1L)).thenReturn(item);
        when(access.lock(ServiceTicket.class, 1L)).thenReturn(ticket);
        when(transactions.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        when(lots.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        when(usages.saveAndFlush(any())).thenAnswer(i -> {
            usage = i.getArgument(0);
            usage.setId(1L);
            when(access.get(PartUsage.class, 1L)).thenReturn(usage);
            when(access.lock(PartUsage.class, 1L)).thenReturn(usage);
            return usage;
        });
    }

    StockAdjustmentRequest adjustment(int quantity) {
        return new StockAdjustmentRequest(1L, 1L, quantity, 1L, null);
    }

    @Test
    void stockInIncreasesAndAudits() {
        service.stockIn(adjustment(2));
        assertEquals(7, stock.getQuantity());
        verify(transactions).saveAndFlush(argThat(t -> t.getTransactionType() == InventoryTransactionType.STOCK_IN && t.getSourceBranch() == null && t.getDestinationBranch() == branch));
    }

    @Test
    void stockOutDecreases() {
        service.stockOut(adjustment(2));
        assertEquals(3, stock.getQuantity());
    }

    @Test
    void insufficientStockDoesNotMutate() {
        assertThrows(InsufficientStockException.class, () -> service.stockOut(adjustment(6)));
        assertEquals(5, stock.getQuantity());
        verifyNoInteractions(transactions);
    }

    @Test
    void usePartCreatesUsageAndAudit() {
        service.usePart(new UsePartRequest(1L, 1L, 2, 1L));
        assertEquals(3, stock.getQuantity());
        assertEquals(PartUsageStatus.ACTIVE, usage.getStatus());
        verify(transactions).saveAndFlush(argThat(t -> t.getPartUsage() == usage && t.getTransactionType() == InventoryTransactionType.USAGE_OUT));
    }

    @Test
    void reversalRestoresAndCannotRepeat() {
        service.usePart(new UsePartRequest(1L, 1L, 2, 1L));
        service.reversePartUsage(new ReversePartUsageRequest(1L, 1L, "Unused"));
        assertEquals(5, stock.getQuantity());
        assertEquals(PartUsageStatus.REVERSED, usage.getStatus());
        assertThrows(ConflictException.class, () -> service.reversePartUsage(new ReversePartUsageRequest(1L, 1L, null)));
        assertEquals(5, stock.getQuantity());
    }

    @Test
    void transferMovesBothAndCreatesOneMovement() {
        var target = TestData.branch(2);
        var other = new BranchInventory();
        other.setBranch(target);
        other.setPart(part);
        other.setQuantity(1);
        when(access.get(Branch.class, 2L)).thenReturn(target);
        when(inventory.findByBranchPartForUpdate(2L, 1L)).thenReturn(Optional.of(other));
        service.transferStock(new TransferStockRequest(1L, 1L, 2L, 2, 1L, null));
        assertEquals(3, stock.getQuantity());
        assertEquals(3, other.getQuantity());
        verify(transactions, times(1)).saveAndFlush(argThat(t -> t.getTransactionType() == InventoryTransactionType.TRANSFER));
        var order = inOrder(inventory);
        order.verify(inventory).findByBranchPartForUpdate(1L, 1L);
        order.verify(inventory).findByBranchPartForUpdate(2L, 1L);
    }
}
