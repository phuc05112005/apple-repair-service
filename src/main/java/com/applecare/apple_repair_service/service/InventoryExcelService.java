package com.applecare.apple_repair_service.service;

import com.applecare.apple_repair_service.dto.request.StockInRequest;
import com.applecare.apple_repair_service.dto.response.InventoryImportResultResponse;
import com.applecare.apple_repair_service.entity.Branch;
import com.applecare.apple_repair_service.entity.Part;
import com.applecare.apple_repair_service.enums.ActiveStatus;
import com.applecare.apple_repair_service.exception.BusinessRuleViolationException;
import com.applecare.apple_repair_service.repository.BranchRepository;
import com.applecare.apple_repair_service.repository.InventoryLotRepository;
import com.applecare.apple_repair_service.repository.PartRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
@RequiredArgsConstructor
public class InventoryExcelService {
    static final String INPUT_SHEET = "Nhập kho";
    private static final int MAX_FILE_BYTES = 2 * 1024 * 1024;
    private static final int MAX_ROWS = 500;
    private static final String[] HEADERS = {
            "Mã nhập kho tham chiếu*", "Mã chi nhánh*", "Mã linh kiện*", "Số lượng*",
            "Thời điểm nhận*", "Nguồn / ghi chú"
    };
    private static final DateTimeFormatter DISPLAY_DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final BranchRepository branches;
    private final PartRepository parts;
    private final InventoryLotRepository lots;
    private final InventoryService inventory;
    private final Clock clock;

    public byte[] createTemplate() {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var input = workbook.createSheet(INPUT_SHEET);
            var guide = workbook.createSheet("Hướng dẫn");
            var references = workbook.createSheet("Danh mục tham chiếu");
            workbook.setSheetHidden(workbook.getSheetIndex(references), true);
            createStylesAndInputSheet(workbook, input);
            createGuideSheet(workbook, guide);
            createReferenceSheet(workbook, input, references);
            workbook.setActiveSheet(0);
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể tạo file mẫu nhập kho.", exception);
        }
    }

    @Transactional
    public InventoryImportResultResponse importWorkbook(MultipartFile file, Long actorId) {
        if (file == null || file.isEmpty()) throw invalid("Vui lòng chọn file Excel .xlsx có dữ liệu.");
        if (file.getSize() > MAX_FILE_BYTES) throw invalid("File Excel vượt quá dung lượng tối đa 2 MB.");
        String filename = Optional.ofNullable(file.getOriginalFilename()).orElse("");
        if (!filename.toLowerCase(Locale.ROOT).endsWith(".xlsx")) throw invalid("Chỉ chấp nhận file Excel định dạng .xlsx.");

        List<ImportRow> rows;
        try {
            rows = parse(file.getBytes());
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof BusinessRuleViolationException business) throw business;
            throw invalid("Không thể đọc file Excel. Vui lòng tải lại file mẫu và không đổi cấu trúc cột.");
        }

        validateRows(rows);
        for (ImportRow row : rows) {
            inventory.stockIn(new StockInRequest(row.code(), row.branchId(), row.partId(), row.quantity(),
                    row.receivedAt(), actorId, row.note()));
        }
        return new InventoryImportResultResponse(rows.size(), rows.stream().map(ImportRow::code).toList());
    }

    private List<ImportRow> parse(byte[] bytes) {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = workbook.getSheet(INPUT_SHEET);
            if (sheet == null) throw invalid("Không tìm thấy sheet “Nhập kho”. Vui lòng dùng đúng file mẫu của hệ thống.");
            validateHeaders(sheet.getRow(0));
            var formatter = new DataFormatter(Locale.forLanguageTag("vi-VN"));
            List<ImportRow> result = new ArrayList<>();
            List<String> errors = new ArrayList<>();
            for (int index = 1; index <= sheet.getLastRowNum(); index++) {
                Row row = sheet.getRow(index);
                if (row == null || isBlank(row, formatter)) continue;
                if (result.size() >= MAX_ROWS) {
                    errors.add("File chỉ được chứa tối đa " + MAX_ROWS + " dòng dữ liệu.");
                    break;
                }
                try {
                    rejectFormulas(row, index + 1);
                    result.add(new ImportRow(
                            requiredText(row, 0, formatter, index + 1),
                            requiredLong(row, 1, formatter, index + 1),
                            requiredLong(row, 2, formatter, index + 1),
                            requiredInteger(row, 3, formatter, index + 1),
                            requiredDateTime(row, 4, formatter, index + 1),
                            optionalText(row, 5, formatter)));
                } catch (IllegalArgumentException exception) {
                    errors.add(exception.getMessage());
                }
            }
            if (!errors.isEmpty()) throw invalid(String.join("; ", errors.stream().limit(30).toList()));
            if (result.isEmpty()) throw invalid("Sheet “Nhập kho” chưa có dòng dữ liệu nào.");
            return result;
        } catch (IOException exception) {
            throw invalid("File Excel bị lỗi hoặc không đúng định dạng .xlsx.");
        }
    }

    private void validateRows(List<ImportRow> rows) {
        List<String> errors = new ArrayList<>();
        Set<String> codes = new HashSet<>();
        LocalDateTime now = LocalDateTime.now(clock);
        for (int index = 0; index < rows.size(); index++) {
            ImportRow row = rows.get(index);
            int excelRow = index + 2;
            String normalized = row.code().trim().toLowerCase(Locale.ROOT);
            if (row.code().length() > 100 || !row.code().matches("[A-Za-z0-9._/-]+"))
                errors.add("Dòng " + excelRow + ": mã nhập kho tham chiếu chỉ dùng chữ không dấu, số và . _ / - (tối đa 100 ký tự).");
            if (!codes.add(normalized)) errors.add("Dòng " + excelRow + ": mã nhập kho tham chiếu bị trùng trong file.");
            else if (lots.existsByLotCodeIgnoreCase(row.code())) errors.add("Dòng " + excelRow + ": mã nhập kho tham chiếu đã tồn tại.");
            Branch branch = branches.findById(row.branchId()).orElse(null);
            if (branch == null) errors.add("Dòng " + excelRow + ": không tìm thấy chi nhánh #" + row.branchId() + ".");
            else if (branch.getStatus() != ActiveStatus.ACTIVE) errors.add("Dòng " + excelRow + ": chi nhánh đang ngừng hoạt động.");
            Part part = parts.findById(row.partId()).orElse(null);
            if (part == null) errors.add("Dòng " + excelRow + ": không tìm thấy linh kiện #" + row.partId() + ".");
            else if (part.getStatus() != ActiveStatus.ACTIVE) errors.add("Dòng " + excelRow + ": linh kiện đang ngừng sử dụng.");
            if (row.quantity() <= 0) errors.add("Dòng " + excelRow + ": số lượng phải là số nguyên lớn hơn 0.");
            if (row.receivedAt().isAfter(now)) errors.add("Dòng " + excelRow + ": thời điểm nhận không được ở tương lai.");
            if (row.note() != null && row.note().length() > 5000) errors.add("Dòng " + excelRow + ": ghi chú vượt quá 5.000 ký tự.");
        }
        if (!errors.isEmpty()) throw invalid("File Excel có lỗi — " + String.join("; ", errors.stream().limit(30).toList()));
    }

    private void createStylesAndInputSheet(XSSFWorkbook workbook, Sheet sheet) {
        var headerStyle = workbook.createCellStyle();
        headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        var headerFont = workbook.createFont();
        headerFont.setBold(true); headerFont.setColor(IndexedColors.WHITE.getIndex());
        headerStyle.setFont(headerFont); headerStyle.setAlignment(HorizontalAlignment.CENTER);
        Row header = sheet.createRow(0);
        for (int i = 0; i < HEADERS.length; i++) { Cell cell = header.createCell(i); cell.setCellValue(HEADERS[i]); cell.setCellStyle(headerStyle); }
        sheet.createFreezePane(0, 1);
        int[] widths = {28, 18, 18, 14, 23, 44};
        for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i] * 256);
        var dateStyle = workbook.createCellStyle(); dateStyle.setDataFormat(workbook.createDataFormat().getFormat("dd/mm/yyyy hh:mm"));
        for (int row = 1; row <= 200; row++) sheet.createRow(row).createCell(4).setCellStyle(dateStyle);
        sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, 200, 0, HEADERS.length - 1));
    }

    private void createGuideSheet(XSSFWorkbook workbook, Sheet sheet) {
        String[] lines = {
                "HƯỚNG DẪN NHẬP KHO TỪ EXCEL",
                "1. Chỉ nhập dữ liệu trong sheet “Nhập kho”; không đổi tên sheet hoặc tiêu đề cột.",
                "2. Mỗi mã nhập kho tham chiếu phải duy nhất. Hệ thống tự sinh mã NHAP_ cho từng dòng; file tải lên chỉ tạo dữ liệu mới, không sửa lịch sử cũ.",
                "3. Chọn mã chi nhánh và mã linh kiện từ danh sách có sẵn trong ô.",
                "4. Số lượng phải là số nguyên dương; thời điểm nhận không được ở tương lai.",
                "5. Hệ thống kiểm tra toàn bộ file trước khi ghi. Có một dòng sai thì toàn bộ file sẽ không được nhập."
        };
        for (int i = 0; i < lines.length; i++) sheet.createRow(i).createCell(0).setCellValue(lines[i]);
        var title = workbook.createCellStyle(); var font = workbook.createFont(); font.setBold(true); font.setFontHeightInPoints((short)14); title.setFont(font); sheet.getRow(0).getCell(0).setCellStyle(title);
        sheet.setColumnWidth(0, 115 * 256);
    }

    private void createReferenceSheet(XSSFWorkbook workbook, Sheet input, Sheet sheet) {
        sheet.createRow(0).createCell(0).setCellValue("Mã chi nhánh"); sheet.getRow(0).createCell(1).setCellValue("Tên chi nhánh");
        List<Branch> activeBranches = branches.findAllByStatusOrderByNameAsc(ActiveStatus.ACTIVE);
        for (int i = 0; i < activeBranches.size(); i++) { Row row = sheet.createRow(i + 1); row.createCell(0).setCellValue(activeBranches.get(i).getId()); row.createCell(1).setCellValue(activeBranches.get(i).getName()); }
        int partStart = Math.max(activeBranches.size() + 3, 4);
        Row partHeader = sheet.createRow(partStart - 1); partHeader.createCell(0).setCellValue("Mã linh kiện"); partHeader.createCell(1).setCellValue("Mã kỹ thuật"); partHeader.createCell(2).setCellValue("Tên / hãng / phiên bản");
        List<Part> activeParts = parts.findAllByStatusOrderByNameAsc(ActiveStatus.ACTIVE);
        for (int i = 0; i < activeParts.size(); i++) { Part part = activeParts.get(i); Row row = sheet.createRow(partStart + i); row.createCell(0).setCellValue(part.getId()); row.createCell(1).setCellValue(part.getPartCode()); row.createCell(2).setCellValue(part.getName() + " · " + Optional.ofNullable(part.getBrand()).orElse("Chưa rõ hãng") + " · " + Optional.ofNullable(part.getVariant()).orElse("Bản tiêu chuẩn")); }
        if (!activeBranches.isEmpty()) addListValidation(input, 1, "'Danh mục tham chiếu'!$A$2:$A$" + (activeBranches.size() + 1));
        if (!activeParts.isEmpty()) addListValidation(input, 2, "'Danh mục tham chiếu'!$A$" + (partStart + 1) + ":$A$" + (partStart + activeParts.size()));
    }

    private void addListValidation(Sheet input, int column, String formula) {
        DataValidationHelper helper = input.getDataValidationHelper();
        DataValidation validation = helper.createValidation(helper.createFormulaListConstraint(formula), new CellRangeAddressList(1, 200, column, column));
        validation.setShowErrorBox(true); validation.createErrorBox("Giá trị không hợp lệ", "Hãy chọn một mã trong danh sách.");
        input.addValidationData(validation);
    }

    private void validateHeaders(Row row) {
        if (row == null) throw invalid("File thiếu hàng tiêu đề.");
        DataFormatter formatter = new DataFormatter();
        for (int index = 0; index < HEADERS.length; index++) if (!HEADERS[index].equals(formatter.formatCellValue(row.getCell(index)).trim()))
            throw invalid("Cột " + (index + 1) + " phải có tiêu đề “" + HEADERS[index] + "”.");
    }

    private void rejectFormulas(Row row, int rowNumber) {
        for (int column = 0; column < HEADERS.length; column++) if (row.getCell(column) != null && row.getCell(column).getCellType() == CellType.FORMULA)
            throw new IllegalArgumentException("Dòng " + rowNumber + ": không dùng công thức Excel trong vùng nhập liệu.");
    }
    private boolean isBlank(Row row, DataFormatter formatter) { for (int i = 0; i < HEADERS.length; i++) if (!formatter.formatCellValue(row.getCell(i)).trim().isEmpty()) return false; return true; }
    private String requiredText(Row row, int column, DataFormatter f, int number) { String value = optionalText(row, column, f); if (value == null) throw new IllegalArgumentException("Dòng " + number + ": thiếu “" + HEADERS[column].replace("*", "") + "”."); return value; }
    private String optionalText(Row row, int column, DataFormatter f) { String value = f.formatCellValue(row.getCell(column)).trim(); return value.isEmpty() ? null : value; }
    private long requiredLong(Row row, int column, DataFormatter f, int number) { String value = requiredText(row, column, f, number); try { return new java.math.BigDecimal(value.replace(",", "")).longValueExact(); } catch (Exception e) { throw new IllegalArgumentException("Dòng " + number + ": “" + HEADERS[column].replace("*", "") + "” phải là số nguyên hợp lệ."); } }
    private int requiredInteger(Row row, int column, DataFormatter f, int number) { long value = requiredLong(row, column, f, number); if (value > Integer.MAX_VALUE || value < Integer.MIN_VALUE) throw new IllegalArgumentException("Dòng " + number + ": số lượng vượt giới hạn."); return (int)value; }
    private LocalDateTime requiredDateTime(Row row, int column, DataFormatter f, int number) {
        Cell cell = row.getCell(column); if (cell != null && cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) return cell.getLocalDateTimeCellValue();
        String value = requiredText(row, column, f, number);
        for (DateTimeFormatter formatter : List.of(DISPLAY_DATE_TIME, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"), DateTimeFormatter.ISO_LOCAL_DATE_TIME)) try { return LocalDateTime.parse(value, formatter); } catch (DateTimeParseException ignored) { }
        throw new IllegalArgumentException("Dòng " + number + ": thời điểm nhận phải theo định dạng dd/MM/yyyy HH:mm.");
    }
    private BusinessRuleViolationException invalid(String message) { return new BusinessRuleViolationException(message); }
    private record ImportRow(String code, Long branchId, Long partId, Integer quantity, LocalDateTime receivedAt, String note) { }
}
