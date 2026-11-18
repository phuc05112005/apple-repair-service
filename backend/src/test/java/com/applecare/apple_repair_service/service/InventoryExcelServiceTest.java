package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.StockAdjustmentRequest;
import com.applecare.apple_repair_service.dto.request.StockInRequest;
import com.applecare.apple_repair_service.dto.response.BranchInventoryResponse;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.BranchInventory;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.repository.BranchInventoryRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class InventoryExcelServiceTest {
    private final InventoryService inventory = mock(InventoryService.class);
    private final BranchInventoryRepository branchInventories = mock(BranchInventoryRepository.class);
    private final EntityManager entityManager = mock(EntityManager.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-09-28T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    private InventoryExcelService service;
    private Branch branch;
    private Part part;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        branch = new Branch();
        branch.setId(1L);
        branch.setName("Táo Care");
        branch.setAddress("TP.HCM");
        branch.setStatus(ActiveStatus.ACTIVE);

        part = new Part();
        part.setId(7L);
        part.setPartCode("BAT-16P-HC");
        part.setName("Pin iPhone 16 Pro");
        part.setBrand("Pisen");
        part.setVariant("Dung lượng cao");
        part.setSalePrice(BigDecimal.TEN);
        part.setStatus(ActiveStatus.ACTIVE);

        BranchInventory bi = new BranchInventory();
        bi.setBranch(branch);
        bi.setPart(part);
        bi.setQuantity(10);

        TypedQuery<Branch> branchQuery = mock(TypedQuery.class);
        when(branchQuery.setParameter(anyString(), any())).thenReturn(branchQuery);
        when(branchQuery.getResultList()).thenReturn(List.of(branch));

        TypedQuery<Part> partQuery = mock(TypedQuery.class);
        when(partQuery.setParameter(anyString(), any())).thenReturn(partQuery);
        when(partQuery.getResultList()).thenReturn(List.of(part));

        when(entityManager.createQuery(contains("FROM Branch"), eq(Branch.class))).thenReturn(branchQuery);
        when(entityManager.createQuery(contains("FROM Part"), eq(Part.class))).thenReturn(partQuery);
        when(branchInventories.findForAdmin(null, null)).thenReturn(List.of(bi));
        when(inventory.getInventory(1L, 7L)).thenReturn(new BranchInventoryResponse(1L, 1L, 7L, 10, null, null));

        service = new InventoryExcelService(inventory, branchInventories, clock);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
    }

    @Test
    void templateContainsInventoryAndGuideSheets() throws Exception {
        byte[] bytes = service.createTemplate();
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertNotNull(workbook.getSheet("Tồn kho linh kiện"));
            assertNotNull(workbook.getSheet("Hướng dẫn"));
            assertEquals("Mã chi nhánh (Không sửa)",
                    workbook.getSheet("Tồn kho linh kiện").getRow(0).getCell(0).getStringCellValue());
            assertEquals(10, (int) workbook.getSheet("Tồn kho linh kiện").getRow(1).getCell(5).getNumericCellValue());
        }
    }

    @Test
    void validWorkbookImportsStockInAndStockOutAfterValidation() throws Exception {
        byte[] bytes = workbookWithRows(new Object[][] {
                { 1L, "Táo Care", "BAT-16P-HC", "Pin iPhone 16 Pro", "Pisen", 10, 15, "Nhập thêm kiểm kê" }
        });
        var file = new MockMultipartFile("file", "ton-kho.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes);

        var result = service.importWorkbook(file, 99L);

        assertEquals(1, result.importedRows());
        var captor = ArgumentCaptor.forClass(StockInRequest.class);
        verify(inventory).stockIn(captor.capture());
        assertEquals(1L, captor.getValue().branchId());
        assertEquals(7L, captor.getValue().partId());
        assertEquals(5, captor.getValue().quantity());
        assertEquals(99L, captor.getValue().receivedByUserId());
    }

    @Test
    void decreaseQuantityTriggersStockOut() throws Exception {
        byte[] bytes = workbookWithRows(new Object[][] {
                { 1L, "Táo Care", "BAT-16P-HC", "Pin iPhone 16 Pro", "Pisen", 10, 7, "Hao hụt kiểm kê" }
        });
        var file = new MockMultipartFile("file", "ton-kho.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes);

        var result = service.importWorkbook(file, 99L);

        assertEquals(1, result.importedRows());
        var captor = ArgumentCaptor.forClass(StockAdjustmentRequest.class);
        verify(inventory).stockOut(captor.capture());
        assertEquals(3, captor.getValue().quantity());
    }

    @Test
    void duplicatePairRejectsWholeWorkbookWithoutWritingStock() throws Exception {
        byte[] bytes = workbookWithRows(new Object[][] {
                { 1L, "Táo Care", "BAT-16P-HC", "Pin iPhone 16 Pro", "Pisen", 10, 12, null },
                { 1L, "Táo Care", "bat-16p-hc", "Pin iPhone 16 Pro", "Pisen", 10, 14, null }
        });
        var file = new MockMultipartFile("file", "ton-kho.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes);

        var error = assertThrows(BusinessRuleViolationException.class, () -> service.importWorkbook(file, 99L));

        assertTrue(error.getMessage().contains("Dòng 3"));
        assertTrue(error.getMessage().contains("Bị trùng"));
        verify(inventory, never()).stockIn(any(StockInRequest.class));
        verify(inventory, never()).stockOut(any(StockAdjustmentRequest.class));
    }

    @Test
    void unknownPartCodeReportsExactExcelRowAndWritesNothing() throws Exception {
        byte[] bytes = workbookWithRows(new Object[][] {
                { 1L, "Táo Care", "UNKNOWN-PART", "Linh kiện lạ", "Pisen", 10, 12, null }
        });
        var file = new MockMultipartFile("file", "ton-kho.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes);

        var error = assertThrows(BusinessRuleViolationException.class, () -> service.importWorkbook(file, 99L));

        assertTrue(error.getMessage().contains("Dòng 2"));
        assertTrue(error.getMessage().contains("UNKNOWN-PART"));
        verify(inventory, never()).stockIn(any(StockInRequest.class));
    }

    private byte[] workbookWithRows(Object[][] values) throws Exception {
        try (var workbook = new XSSFWorkbook();
                var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("Tồn kho linh kiện");
            var header = sheet.createRow(0);
            for (int c = 0; c < 8; c++) {
                header.createCell(c).setCellValue("Col " + c);
            }
            for (int i = 0; i < values.length; i++) {
                var row = sheet.createRow(i + 1);
                Object[] r = values[i];
                row.createCell(0).setCellValue((Long) r[0]);
                row.createCell(1).setCellValue((String) r[1]);
                row.createCell(2).setCellValue((String) r[2]);
                row.createCell(3).setCellValue((String) r[3]);
                row.createCell(4).setCellValue((String) r[4]);
                row.createCell(5).setCellValue((Integer) r[5]);
                row.createCell(6).setCellValue((Integer) r[6]);
                if (r[7] != null) {
                    row.createCell(7).setCellValue((String) r[7]);
                }
            }
            workbook.write(output);
            return output.toByteArray();
        }
    }
}