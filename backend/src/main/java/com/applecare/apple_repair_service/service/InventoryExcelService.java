package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.StockAdjustmentRequest;
import com.applecare.apple_repair_service.dto.request.StockInRequest;
import com.applecare.apple_repair_service.dto.response.InventoryImportResultResponse;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.BranchInventory;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.repository.BranchInventoryRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InventoryExcelService {

    private static final String SHEET_DATA = "Tồn kho linh kiện";
    private static final String SHEET_GUIDE = "Hướng dẫn";
    private static final DateTimeFormatter LOT_TS_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final InventoryService inventoryService;
    private final BranchInventoryRepository branchInventoryRepository;
    private final Clock clock;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(readOnly = true)
    public byte[] createTemplate() {
        List<Branch> branches = entityManager.createQuery(
                        "SELECT b FROM Branch b WHERE b.status = :status ORDER BY b.id ASC", Branch.class)
                .setParameter("status", ActiveStatus.ACTIVE)
                .getResultList();

        List<Part> parts = entityManager.createQuery(
                        "SELECT p FROM Part p WHERE p.status = :status ORDER BY p.brand ASC, p.name ASC, p.id ASC", Part.class)
                .setParameter("status", ActiveStatus.ACTIVE)
                .getResultList();

        Map<String, Integer> stockMap = branchInventoryRepository.findForAdmin(null, null).stream()
                .collect(Collectors.toMap(
                        bi -> bi.getBranch().getId() + ":" + bi.getPart().getId(),
                        BranchInventory::getQuantity,
                        (a, b) -> a
                ));

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet(SHEET_DATA);

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorders(headerStyle);

            CellStyle readOnlyStyle = workbook.createCellStyle();
            readOnlyStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            readOnlyStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            readOnlyStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            setBorders(readOnlyStyle);

            CellStyle readOnlyCenterStyle = workbook.createCellStyle();
            readOnlyCenterStyle.cloneStyleFrom(readOnlyStyle);
            readOnlyCenterStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle editableQtyStyle = workbook.createCellStyle();
            Font editableFont = workbook.createFont();
            editableFont.setBold(true);
            editableStyleSetup(editableQtyStyle, editableFont, HorizontalAlignment.CENTER);

            CellStyle editableNoteStyle = workbook.createCellStyle();
            Font noteFont = workbook.createFont();
            editableStyleSetup(editableNoteStyle, noteFont, HorizontalAlignment.LEFT);

            String[] headers = {
                    "Mã chi nhánh (Không sửa)",
                    "Tên chi nhánh",
                    "Mã linh kiện (Không sửa)",
                    "Tên linh kiện",
                    "Hãng / Phân loại",
                    "Tồn kho lúc xuất (Không sửa)",
                    "Số lượng mới (Chỉnh cột này)",
                    "Ghi chú điều chỉnh (Tùy chọn)"
            };

            Row headerRow = sheet.createRow(0);
            headerRow.setHeightInPoints(26);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (Branch branch : branches) {
                for (Part part : parts) {
                    int currentQty = stockMap.getOrDefault(branch.getId() + ":" + part.getId(), 0);
                    String brandVariant = joinBrandVariant(part.getBrand(), part.getVariant());

                    Row row = sheet.createRow(rowIdx++);
                    row.setHeightInPoints(20);

                    Cell c0 = row.createCell(0);
                    c0.setCellValue(branch.getId());
                    c0.setCellStyle(readOnlyCenterStyle);

                    Cell c1 = row.createCell(1);
                    c1.setCellValue(branch.getName());
                    c1.setCellStyle(readOnlyStyle);

                    Cell c2 = row.createCell(2);
                    c2.setCellValue(part.getPartCode());
                    c2.setCellStyle(readOnlyStyle);

                    Cell c3 = row.createCell(3);
                    c3.setCellValue(part.getName());
                    c3.setCellStyle(readOnlyStyle);

                    Cell c4 = row.createCell(4);
                    c4.setCellValue(brandVariant);
                    c4.setCellStyle(readOnlyStyle);

                    Cell c5 = row.createCell(5);
                    c5.setCellValue(currentQty);
                    c5.setCellStyle(readOnlyCenterStyle);

                    Cell c6 = row.createCell(6);
                    c6.setCellValue(currentQty);
                    c6.setCellStyle(editableQtyStyle);

                    Cell c7 = row.createCell(7);
                    c7.setCellValue("");
                    c7.setCellStyle(editableNoteStyle);
                }
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                sheet.setColumnWidth(i, Math.min(sheet.getColumnWidth(i) + 1024, 14000));
            }
            sheet.createFreezePane(0, 1);

            buildGuideSheet(workbook);

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new BusinessRuleViolationException("Không thể tạo file Excel tồn kho: " + e.getMessage());
        }
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InventoryImportResultResponse importWorkbook(MultipartFile file, Long actorId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessRuleViolationException("Vui lòng chọn file Excel (.xlsx) để cập nhật tồn kho.");
        }
        String originalName = file.getOriginalFilename();
        if (originalName == null || !originalName.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            throw new BusinessRuleViolationException("Định dạng file không hợp lệ. Hệ thống chỉ hỗ trợ file .xlsx.");
        }

        Map<Long, Branch> branchMap = entityManager.createQuery("SELECT b FROM Branch b", Branch.class)
                .getResultList().stream()
                .collect(Collectors.toMap(Branch::getId, b -> b));

        Map<String, Part> partByCodeMap = entityManager.createQuery("SELECT p FROM Part p", Part.class)
                .getResultList().stream()
                .collect(Collectors.toMap(
                        p -> p.getPartCode().trim().toUpperCase(Locale.ROOT),
                        p -> p,
                        (a, b) -> a
                ));

        List<ExcelStockRow> changedRows = new ArrayList<>();
        Set<String> seenPairs = new HashSet<>();
        DataFormatter formatter = new DataFormatter();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheet(SHEET_DATA);
            if (sheet == null) {
                sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            }
            if (sheet == null || sheet.getLastRowNum() < 1) {
                throw new BusinessRuleViolationException("File Excel không có dữ liệu để cập nhật.");
            }

            Row header = sheet.getRow(0);
            if (header == null || header.getLastCellNum() < 7) {
                throw new BusinessRuleViolationException(
                        "Cấu trúc cột không khớp với file xuất từ hệ thống. Vui lòng xuất lại file Excel mới nhất.");
            }

            // Bước 1: Kiểm tra toàn bộ file trước khi ghi DB (All-or-Nothing)
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (isRowEmpty(row, formatter)) continue;

                int excelRowNum = r + 1;

                String branchIdStr = readCell(row, 0, formatter);
                String partCode = readCell(row, 2, formatter);
                String exportedQtyStr = readCell(row, 5, formatter);
                String newQtyStr = readCell(row, 6, formatter);
                String note = readCell(row, 7, formatter);

                if (branchIdStr.isEmpty() || partCode.isEmpty()) {
                    throw new BusinessRuleViolationException(
                            String.format("Dòng %d: Thiếu Mã chi nhánh hoặc Mã linh kiện.", excelRowNum));
                }

                long branchId;
                try {
                    branchId = Long.parseLong(branchIdStr.replaceAll("\\.0+$", ""));
                } catch (NumberFormatException e) {
                    throw new BusinessRuleViolationException(
                            String.format("Dòng %d: Mã chi nhánh '%s' không hợp lệ.", excelRowNum, branchIdStr));
                }

                Branch branch = branchMap.get(branchId);
                if (branch == null) {
                    throw new BusinessRuleViolationException(
                            String.format("Dòng %d: Không tìm thấy chi nhánh mã %d.", excelRowNum, branchId));
                }
                if (branch.getStatus() != ActiveStatus.ACTIVE) {
                    throw new BusinessRuleViolationException(
                            String.format("Dòng %d: Chi nhánh '%s' đang ngừng hoạt động.", excelRowNum, branch.getName()));
                }

                Part part = partByCodeMap.get(partCode.toUpperCase(Locale.ROOT));
                if (part == null) {
                    throw new BusinessRuleViolationException(
                            String.format("Dòng %d: Không tìm thấy mã linh kiện '%s'.", excelRowNum, partCode));
                }
                if (part.getStatus() != ActiveStatus.ACTIVE) {
                    throw new BusinessRuleViolationException(
                            String.format("Dòng %d: Linh kiện '%s' đang ngừng sử dụng.", excelRowNum, partCode));
                }

                String pairKey = branchId + ":" + part.getId();
                if (!seenPairs.add(pairKey)) {
                    throw new BusinessRuleViolationException(
                            String.format("Dòng %d: Bị trùng cặp chi nhánh '%s' và linh kiện '%s' trong file.",
                                    excelRowNum, branch.getName(), partCode));
                }

                int exportedQty = parseNonNegativeInt(exportedQtyStr, excelRowNum, partCode, "Tồn kho lúc xuất");
                if (newQtyStr.isEmpty()) {
                    throw new BusinessRuleViolationException(
                            String.format("Dòng %d (%s): Cột 'Số lượng mới' không được để trống.", excelRowNum, partCode));
                }
                int newQty = parseNonNegativeInt(newQtyStr, excelRowNum, partCode, "Số lượng mới");

                if (newQty != exportedQty) {
                    changedRows.add(new ExcelStockRow(
                            excelRowNum,
                            branch.getId(),
                            part.getId(),
                            part.getPartCode(),
                            newQty,
                            note.isEmpty() ? null : note
                    ));
                }
            }
        } catch (BusinessRuleViolationException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessRuleViolationException("Không thể đọc file Excel: " + e.getMessage());
        }

        // Bước 2: Thực thi cập nhật tồn kho & ghi lịch sử thông qua InventoryService chuẩn
        LocalDateTime now = LocalDateTime.now(clock);
        String batchTs = now.format(LOT_TS_FORMAT);
        List<String> transactionCodes = new ArrayList<>();

        for (ExcelStockRow row : changedRows) {
            int currentDbQty = inventoryService.getInventory(row.branchId(), row.partId()).quantity();
            int diff = row.newQty() - currentDbQty;

            if (diff == 0) {
                continue;
            }

            String baseAudit = String.format("Cập nhật tồn kho qua Excel (%d → %d)", currentDbQty, row.newQty());
            String fullNote = row.note() != null ? baseAudit + " · " + row.note() : baseAudit;

            if (diff > 0) {
                String autoLotCode = String.format("EXCEL_NHAP_%s_%d", batchTs, row.excelRowNum());
                inventoryService.stockIn(new StockInRequest(
                        autoLotCode,
                        row.branchId(),
                        row.partId(),
                        diff,
                        null,
                        null,
                        now,
                        actorId,
                        fullNote
                ));
                transactionCodes.add(autoLotCode);
            } else {
                int decreaseQty = Math.abs(diff);
                inventoryService.stockOut(new StockAdjustmentRequest(
                        row.branchId(),
                        row.partId(),
                        decreaseQty,
                        actorId,
                        fullNote
                ));
                transactionCodes.add(String.format("EXCEL_XUAT_%s_%d", batchTs, row.excelRowNum()));
            }
        }

        return new InventoryImportResultResponse(transactionCodes.size(), transactionCodes);
    }

    private void buildGuideSheet(XSSFWorkbook workbook) {
        Sheet guide = workbook.createSheet(SHEET_GUIDE);
        CellStyle titleStyle = workbook.createCellStyle();
        Font titleFont = workbook.createFont();
        titleFont.setBold(true);
        titleFont.setFontHeightInPoints((short) 13);
        titleStyle.setFont(titleFont);

        String[] lines = {
                "HƯỚNG DẪN CẬP NHẬT TỒN KHO BẰNG EXCEL",
                "1. Mở sheet 'Tồn kho linh kiện', chỉ chỉnh sửa cột G (Số lượng mới) và cột H (Ghi chú điều chỉnh).",
                "2. Không sửa Mã chi nhánh (cột A), Mã linh kiện (cột C), Tồn kho lúc xuất (cột F) hoặc đổi tên sheet.",
                "3. Những dòng không thay đổi số lượng sẽ được hệ thống tự động bỏ qua (không ảnh hưởng giao dịch khác).",
                "4. Dòng tăng số lượng sẽ tự động tạo lịch sử Nhập kho (STOCK_IN); dòng giảm số lượng sẽ tạo lịch sử Xuất kho (STOCK_OUT).",
                "5. Số lượng mới phải là số nguyên >= 0. Nếu có bất kỳ dòng nào sai, toàn bộ file sẽ không được lưu để bảo vệ dữ liệu."
        };

        for (int i = 0; i < lines.length; i++) {
            Row r = guide.createRow(i);
            Cell c = r.createCell(0);
            c.setCellValue(lines[i]);
            if (i == 0) c.setCellStyle(titleStyle);
        }
        guide.autoSizeColumn(0);
    }

    private static void editableStyleSetup(CellStyle style, Font font, HorizontalAlignment align) {
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(align);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        setBorders(style);
    }

    private static void setBorders(CellStyle style) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
    }

    private static String joinBrandVariant(String brand, String variant) {
        String b = brand != null && !brand.isBlank() ? brand.trim() : "";
        String v = variant != null && !variant.isBlank() ? variant.trim() : "";
        if (!b.isEmpty() && !v.isEmpty()) return b + " · " + v;
        return !b.isEmpty() ? b : (!v.isEmpty() ? v : "Tiêu chuẩn");
    }

    private static String readCell(Row row, int colIdx, DataFormatter formatter) {
        if (row == null) return "";
        Cell cell = row.getCell(colIdx, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return "";
        return formatter.formatCellValue(cell).trim();
    }

    private static boolean isRowEmpty(Row row, DataFormatter formatter) {
        if (row == null) return true;
        for (int i = 0; i <= 7; i++) {
            if (!readCell(row, i, formatter).isEmpty()) return false;
        }
        return true;
    }

    private static int parseNonNegativeInt(String raw, int excelRowNum, String partCode, String colLabel) {
        try {
            String normalized = raw.replace(",", "").trim();
            if (normalized.contains(".")) {
                double d = Double.parseDouble(normalized);
                if (d != Math.floor(d)) {
                    throw new NumberFormatException("Decimal not allowed");
                }
                normalized = String.valueOf((long) d);
            }
            int val = Integer.parseInt(normalized);
            if (val < 0) {
                throw new BusinessRuleViolationException(
                        String.format("Dòng %d (%s): '%s' không được nhỏ hơn 0.", excelRowNum, partCode, colLabel));
            }
            return val;
        } catch (NumberFormatException e) {
            throw new BusinessRuleViolationException(
                    String.format("Dòng %d (%s): Giá trị '%s' ở cột '%s' phải là số nguyên không âm.",
                            excelRowNum, partCode, raw, colLabel));
        }
    }

    private record ExcelStockRow(
            int excelRowNum,
            Long branchId,
            Long partId,
            String partCode,
            int newQty,
            String note
    ) {}
}