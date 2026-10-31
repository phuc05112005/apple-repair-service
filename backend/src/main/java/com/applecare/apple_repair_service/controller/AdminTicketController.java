package com.applecare.apple_repair_service.controller;

import com.applecare.apple_repair_service.dto.response.AdminTicketSummaryResponse;
import com.applecare.apple_repair_service.dto.response.RepairItemDetailResponse;
import com.applecare.apple_repair_service.dto.response.ServiceTicketDetailResponse;
import com.applecare.apple_repair_service.service.ServiceTicketService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/tickets")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminTicketController {

    private final ServiceTicketService serviceTicketService;

    @PersistenceContext
    private EntityManager entityManager;

    @GetMapping
    @SuppressWarnings({"unchecked", "SqlNoDataSourceInspection", "SqlDialectInspection"})
    public ResponseEntity<List<AdminTicketSummaryResponse>> getAllTickets(
            @RequestParam(required = false) Long branchId) {

        String sql = """
            SELECT 
                st.id AS ticket_id,
                st.ticket_code,
                COALESCE(c.full_name, 'Khách lẻ') AS customer_full_name,
                c.phone AS customer_phone,
                COALESCE(dm.name, 'Chưa xác định') AS device_model_name,
                cd.serial_number AS imei_or_serial,
                st.branch_id,
                b.name AS branch_name,
                COALESCE(u_tech.full_name, 'Chưa phân công') AS technician_name,
                COALESCE(sums.total_amount, 0) AS total_amount,
                st.status AS status,
                st.received_at,
                COALESCE(st_type.service_type_codes_list, 'REPAIR') AS service_type
            FROM service_tickets st
            LEFT JOIN branches b ON st.branch_id = b.id
            LEFT JOIN customer_devices cd ON st.customer_device_id = cd.id
            LEFT JOIN customers c ON cd.customer_id = c.id
            LEFT JOIN device_models dm ON cd.device_model_id = dm.id
            /* LẤY CHÍNH XÁC 1 KỸ THUẬT VIÊN PHỤ TRÁCH MỚI NHẤT ĐỂ TRÁNH NHÂN ĐÔI TRÙNG DÒNG PHIẾU */
            LEFT JOIN (
                SELECT a1.service_ticket_id, u.full_name 
                FROM assignments a1
                JOIN users u ON a1.technician_id = u.id
                INNER JOIN (
                    SELECT service_ticket_id, MAX(id) AS max_id
                    FROM assignments
                    WHERE status IN ('ACTIVE', 'ENDED')
                    GROUP BY service_ticket_id
                ) a2 ON a1.id = a2.max_id
            ) u_tech ON u_tech.service_ticket_id = st.id
            LEFT JOIN (
                SELECT service_ticket_id, 
                       SUM(COALESCE(final_price, base_price, 0)) AS total_amount 
                FROM repair_items 
                WHERE approval_status = 'APPROVED' OR approval_status IS NULL
                GROUP BY service_ticket_id
            ) sums ON sums.service_ticket_id = st.id
            LEFT JOIN (
                SELECT ri.service_ticket_id,
                       GROUP_CONCAT(DISTINCT CASE 
                           WHEN sci.part_id IS NOT NULL 
                             OR LOWER(COALESCE(ri.item_name_snapshot, sci.name, '')) LIKE '%thay%' 
                           THEN 'REPLACEMENT' 
                           ELSE 'REPAIR' 
                       END ORDER BY CASE WHEN sci.part_id IS NOT NULL THEN 'REPLACEMENT' ELSE 'REPAIR' END SEPARATOR ', ') AS service_type_codes_list
                FROM repair_items ri
                LEFT JOIN service_catalog_items sci ON ri.service_catalog_item_id = sci.id
                WHERE ri.approval_status = 'APPROVED' OR ri.approval_status IS NULL
                GROUP BY ri.service_ticket_id
            ) st_type ON st_type.service_ticket_id = st.id
            WHERE (:branchId IS NULL OR st.branch_id = :branchId)
            ORDER BY st.received_at DESC, st.id DESC
            """;

        var query = entityManager.createNativeQuery(sql);
        query.setParameter("branchId", branchId);

        List<Object[]> rows = query.getResultList();
        List<AdminTicketSummaryResponse> result = new ArrayList<>();

        for (Object[] row : rows) {
            Long id = row[0] != null ? ((Number) row[0]).longValue() : 0L;
            String ticketCode = row[1] != null ? row[1].toString() : "";
            String customerFullName = row[2] != null ? row[2].toString() : "Khách lẻ";
            String customerPhone = row[3] != null ? row[3].toString() : "";
            String deviceModelName = row[4] != null ? row[4].toString() : "Chưa xác định";
            String imeiOrSerial = row[5] != null ? row[5].toString() : "";
            Long bId = row[6] != null ? ((Number) row[6]).longValue() : null;
            String branchName = row[7] != null ? row[7].toString() : "";
            String technicianName = row[8] != null ? row[8].toString() : "Chưa phân công";
            BigDecimal totalAmount = row[9] != null ? new BigDecimal(row[9].toString()) : BigDecimal.ZERO;
            String status = row[10] != null ? row[10].toString() : "";

            LocalDateTime receivedAt = null;
            if (row[11] instanceof Timestamp ts) {
                receivedAt = ts.toLocalDateTime();
            } else if (row[11] instanceof LocalDateTime ldt) {
                receivedAt = ldt;
            }

            String serviceType = row.length > 12 && row[12] != null ? row[12].toString() : "REPAIR";

            result.add(new AdminTicketSummaryResponse(
                    id, ticketCode, customerFullName, customerPhone,
                    deviceModelName, imeiOrSerial, bId, branchName,
                    technicianName, totalAmount, status, receivedAt, serviceType
            ));
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ServiceTicketDetailResponse> getTicketDetail(@PathVariable Long id) {
        return ResponseEntity.ok(serviceTicketService.getById(id));
    }

    @GetMapping("/{id}/items")
    @SuppressWarnings({"unchecked", "SqlNoDataSourceInspection", "SqlDialectInspection"})
    public ResponseEntity<List<RepairItemDetailResponse>> getTicketRepairItems(@PathVariable Long id) {
        String sql = """
            SELECT 
                ri.id AS repair_item_id,
                ri.service_ticket_id,
                CASE 
                    WHEN p.id IS NOT NULL OR sci.part_id IS NOT NULL THEN 'REPLACEMENT'
                    WHEN LOWER(COALESCE(sci.name, ri.item_name_snapshot, '')) LIKE '%thay%' THEN 'REPLACEMENT'
                    ELSE 'REPAIR'
                END AS service_type,
                CASE 
                    WHEN p.name IS NOT NULL THEN p.name
                    WHEN sci.name IS NOT NULL AND sci.name NOT IN ('Thay thế linh kiện', 'Dịch vụ sửa chữa', 'Sửa chữa') THEN sci.name
                    WHEN ri.item_name_snapshot IS NOT NULL AND ri.item_name_snapshot NOT IN ('Thay thế linh kiện', 'Dịch vụ sửa chữa', 'Sửa chữa') THEN ri.item_name_snapshot
                    ELSE COALESCE(p.name, sci.name, ri.item_name_snapshot, 'Chi tiết hạng mục')
                END AS service_name,
                COALESCE(ri.final_price, ri.base_price, 0) AS final_price,
                p.name AS part_name,
                p.part_code AS part_code,
                p.brand AS part_brand,
                p.variant AS part_variant,
                ri.approval_status
            FROM repair_items ri
            LEFT JOIN service_catalog_items sci ON ri.service_catalog_item_id = sci.id
            LEFT JOIN parts p ON sci.part_id = p.id
            WHERE ri.service_ticket_id = :ticketId
              AND (ri.approval_status IS NULL OR ri.approval_status != 'REJECTED')
            ORDER BY ri.id ASC
            """;

        var query = entityManager.createNativeQuery(sql);
        query.setParameter("ticketId", id);

        List<Object[]> rows = query.getResultList();
        List<RepairItemDetailResponse> result = new ArrayList<>();

        for (Object[] row : rows) {
            Long repairItemId = row[0] != null ? ((Number) row[0]).longValue() : 0L;
            Long serviceTicketId = row[1] != null ? ((Number) row[1]).longValue() : 0L;
            String serviceType = row[2] != null ? row[2].toString() : "REPAIR";
            String serviceName = row[3] != null ? row[3].toString() : "Sửa chữa";
            BigDecimal finalPrice = row[4] != null ? new BigDecimal(row[4].toString()) : BigDecimal.ZERO;
            String partName = row[5] != null ? row[5].toString() : null;
            String partCode = row[6] != null ? row[6].toString() : null;
            String partBrand = row[7] != null ? row[7].toString() : null;
            String partVariant = row[8] != null ? row[8].toString() : null;
            String approvalStatus = row[9] != null ? row[9].toString() : null;

            result.add(new RepairItemDetailResponse(
                    repairItemId, serviceTicketId, serviceType, serviceName,
                    finalPrice, partName, partCode, partBrand, partVariant, approvalStatus
            ));
        }

        return ResponseEntity.ok(result);
    }
}