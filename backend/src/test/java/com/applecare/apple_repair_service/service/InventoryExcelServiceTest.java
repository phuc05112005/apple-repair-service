package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.StockInRequest;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.repository.BranchRepository;
import com.applecare.apple_repair_service.repository.InventoryLotRepository;
import com.applecare.apple_repair_service.repository.PartRepository;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InventoryExcelServiceTest {
    private final BranchRepository branches = mock(BranchRepository.class);
    private final PartRepository parts = mock(PartRepository.class);
    private final InventoryLotRepository lots = mock(InventoryLotRepository.class);
    private final InventoryService inventory = mock(InventoryService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-09-28T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private InventoryExcelService service;
    private Branch branch;
    private Part part;

    @BeforeEach
    void setUp() {
        branch = new Branch(); branch.setId(1L); branch.setName("Táo Care"); branch.setAddress("TP.HCM");
        part = new Part(); part.setId(7L); part.setPartCode("BAT-16P-HC"); part.setName("Pin iPhone 16 Pro"); part.setBrand("Pisen"); part.setVariant("Dung lượng cao"); part.setSalePrice(java.math.BigDecimal.TEN);
        when(branches.findAllByStatusOrderByNameAsc(ActiveStatus.ACTIVE)).thenReturn(List.of(branch));
        when(parts.findAllByStatusOrderByNameAsc(ActiveStatus.ACTIVE)).thenReturn(List.of(part));
        when(branches.findById(1L)).thenReturn(Optional.of(branch));
        when(parts.findById(7L)).thenReturn(Optional.of(part));
        service = new InventoryExcelService(branches, parts, lots, inventory, clock);
    }

    @Test
    void templateContainsInputGuideAndProtectedReferenceLists() throws Exception {
        byte[] bytes = service.createTemplate();
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertNotNull(workbook.getSheet("Nhập kho"));
            assertNotNull(workbook.getSheet("Hướng dẫn"));
            assertTrue(workbook.isSheetHidden(workbook.getSheetIndex("Danh mục tham chiếu")));
            assertEquals("Mã nhập kho tham chiếu*", workbook.getSheet("Nhập kho").getRow(0).getCell(0).getStringCellValue());
            assertFalse(workbook.getSheet("Nhập kho").getDataValidations().isEmpty());
        }
    }

    @Test
    void validWorkbookImportsOnlyAfterWholeFileValidation() throws Exception {
        byte[] bytes = workbookWithRows(new Object[][] {
                {"NK-20260928-001", 1L, 7L, 5, LocalDateTime.of(2026, 9, 28, 9, 30), "Nhà cung cấp Pisen"}
        });
        var file = new MockMultipartFile("file", "nhap-kho.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes);

        var result = service.importWorkbook(file, 99L);

        assertEquals(1, result.importedRows());
        var captor = ArgumentCaptor.forClass(StockInRequest.class);
        verify(inventory).stockIn(captor.capture());
        assertEquals("NK-20260928-001", captor.getValue().lotCode());
        assertEquals(7L, captor.getValue().partId());
        assertEquals(5, captor.getValue().quantity());
    }

    @Test
    void duplicateCodeRejectsWholeWorkbookWithoutWritingStock() throws Exception {
        byte[] bytes = workbookWithRows(new Object[][] {
                {"NK-DUP", 1L, 7L, 2, LocalDateTime.of(2026, 9, 28, 8, 0), null},
                {"nk-dup", 1L, 7L, 3, LocalDateTime.of(2026, 9, 28, 9, 0), null}
        });
        var file = new MockMultipartFile("file", "nhap-kho.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes);

        var error = assertThrows(BusinessRuleViolationException.class, () -> service.importWorkbook(file, 99L));

        assertTrue(error.getMessage().contains("Dòng 3"));
        assertTrue(error.getMessage().contains("bị trùng"));
        verifyNoInteractions(inventory);
    }

    @Test
    void unknownPartReportsExactExcelRowAndWritesNothing() throws Exception {
        byte[] bytes = workbookWithRows(new Object[][] {
                {"NK-UNKNOWN", 1L, 999L, 2, LocalDateTime.of(2026, 9, 28, 8, 0), null}
        });
        var file = new MockMultipartFile("file", "nhap-kho.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes);

        var error = assertThrows(BusinessRuleViolationException.class, () -> service.importWorkbook(file, 99L));

        assertTrue(error.getMessage().contains("Dòng 2"));
        assertTrue(error.getMessage().contains("linh kiện #999"));
        verifyNoInteractions(inventory);
    }

    private byte[] workbookWithRows(Object[][] values) throws Exception {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(service.createTemplate()));
             var output = new ByteArrayOutputStream()) {
            var sheet = workbook.getSheet("Nhập kho");
            for (int index = 0; index < values.length; index++) {
                var row = sheet.getRow(index + 1);
                Object[] valuesForRow = values[index];
                row.createCell(0).setCellValue((String) valuesForRow[0]);
                row.createCell(1).setCellValue((Long) valuesForRow[1]);
                row.createCell(2).setCellValue((Long) valuesForRow[2]);
                row.createCell(3).setCellValue((Integer) valuesForRow[3]);
                row.getCell(4).setCellValue((LocalDateTime) valuesForRow[4]);
                if (valuesForRow[5] != null) row.createCell(5).setCellValue((String) valuesForRow[5]);
            }
            workbook.write(output);
            return output.toByteArray();
        }
    }
}
