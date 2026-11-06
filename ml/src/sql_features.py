"""SQL dùng CHUNG cho trích xuất dữ liệu train (01) và lấy đặc trưng lúc dự đoán (06).
Một định nghĩa duy nhất => đặc trưng lúc train và lúc serve luôn cùng ý nghĩa (chống train/serve skew)."""


def services_subquery(extra_where: str = "") -> str:
    """Gộp các hạng mục sửa chữa của phiếu: 1 phiếu = 1 dòng, KHÔNG bị nhân dòng bởi join part_usages.
    Hạng mục bị từ chối (REJECTED) không được thực hiện nên không tính vào định mức."""
    return f"""
    SELECT
        ri.service_ticket_id,
        COUNT(DISTINCT ri.id) AS total_services_count,
        GROUP_CONCAT(DISTINCT s_issue.id ORDER BY s_issue.id SEPARATOR ',') AS service_issue_ids_list,
        GROUP_CONCAT(DISTINCT s_issue.name ORDER BY s_issue.id SEPARATOR ' + ') AS service_issue_names_list,
        GROUP_CONCAT(DISTINCT styp.code ORDER BY ri.id SEPARATOR ', ') AS service_type_codes_list,
        SUM(sci.standard_duration_minutes) AS total_catalog_standard_duration_minutes
    FROM repair_items ri
    LEFT JOIN service_catalog_items sci ON ri.service_catalog_item_id = sci.id
    LEFT JOIN service_types styp ON sci.service_type_id = styp.id
    LEFT JOIN service_issues s_issue ON sci.service_issue_id = s_issue.id
    WHERE COALESCE(ri.approval_status, '') <> 'REJECTED' {extra_where}
    GROUP BY ri.service_ticket_id
    """
