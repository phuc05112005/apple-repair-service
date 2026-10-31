import os
import sys
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine

sys.stdout.reconfigure(line_buffering=True)

# -----------------------------------------------------------------------------
# CẤU HÌNH ĐƯỜNG DẪN & KẾT NỐI CSDL (DOCKER PORT 3307)
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DATA_PATH = BASE_DIR / "data" / "raw" / "raw_tickets_active.csv"

DB_CONFIG = {
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "123456"),
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "3307"),  # Cổng MySQL Docker
    "database": os.getenv("DB_NAME", "apple_repair_service"),
}


def get_db_engine():
    connection_url = (
        f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}"
        f"@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}?charset=utf8mb4"
    )
    return create_engine(connection_url)


# -----------------------------------------------------------------------------
# QUERY TRÍCH XUẤT CHUẨN GOM NHÓM (1 PHIẾU = 1 DÒNG)
# -----------------------------------------------------------------------------
SQL_QUERY = """
SELECT 
    st.id AS ticket_id,
    st.ticket_code,
    st.branch_id,
    cd.device_model_id,
    dm.name AS device_model_name,
    COALESCE(services_summary.total_services_count, 0) AS total_services_count,
    services_summary.service_issue_ids_list,
    services_summary.service_issue_names_list,
    services_summary.service_type_codes_list,
    COALESCE(services_summary.total_catalog_standard_duration_minutes, 0) AS total_catalog_standard_duration_minutes,
    COALESCE(parts_summary.total_parts_quantity_used, 0) AS total_parts_quantity_used,
    a_final.technician_id,
    u_tech.full_name AS technician_name,
    CASE WHEN COALESCE(assign_summary.total_assignments, 1) > 1 THEN 1 ELSE 0 END AS is_reassigned,
    COALESCE(pause_summary.count_waiting_part_events, 0) AS count_waiting_part_events,
    COALESCE(pause_summary.count_waiting_approval_events, 0) AS count_waiting_approval_events,
    COALESCE(pause_summary.total_pause_events_count, 0) AS total_pause_events_count,
    COALESCE(pause_summary.total_pause_duration_minutes, 0) AS total_pause_duration_minutes,
    st.actual_repair_started_at,
    st.actual_repair_completed_at,
    TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at) AS actual_repair_duration_minutes,
    (TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at) 
     - COALESCE(pause_summary.total_pause_duration_minutes, 0)) AS net_repair_duration_minutes
FROM service_tickets st
LEFT JOIN customer_devices cd ON st.customer_device_id = cd.id
LEFT JOIN device_models dm ON cd.device_model_id = dm.id
LEFT JOIN assignments a_final ON st.id = a_final.service_ticket_id AND a_final.status IN ('ENDED', 'ACTIVE')
LEFT JOIN users u_tech ON a_final.technician_id = u_tech.id
LEFT JOIN (
    SELECT service_ticket_id, COUNT(*) AS total_assignments
    FROM assignments GROUP BY service_ticket_id
) assign_summary ON st.id = assign_summary.service_ticket_id
LEFT JOIN (
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
    GROUP BY ri.service_ticket_id
) services_summary ON st.id = services_summary.service_ticket_id
LEFT JOIN (
    SELECT 
        ri.service_ticket_id,
        SUM(COALESCE(pu.quantity, 0)) AS total_parts_quantity_used
    FROM repair_items ri
    INNER JOIN part_usages pu ON ri.id = pu.repair_item_id AND pu.status = 'ACTIVE'
    GROUP BY ri.service_ticket_id
) parts_summary ON st.id = parts_summary.service_ticket_id
LEFT JOIN (
    SELECT 
        service_ticket_id,
        SUM(CASE WHEN to_status = 'WAITING_PART' THEN 1 ELSE 0 END) AS count_waiting_part_events,
        SUM(CASE WHEN to_status = 'WAITING_APPROVAL' THEN 1 ELSE 0 END) AS count_waiting_approval_events,
        COUNT(*) AS total_pause_events_count,
        SUM(TIMESTAMPDIFF(MINUTE, changed_at, resolved_at)) AS total_pause_duration_minutes
    FROM service_status_histories
    WHERE to_status IN ('WAITING_PART', 'WAITING_APPROVAL') AND resolved_at IS NOT NULL
    GROUP BY service_ticket_id
) pause_summary ON st.id = pause_summary.service_ticket_id
WHERE st.actual_repair_started_at IS NOT NULL 
  AND st.actual_repair_completed_at IS NOT NULL
  AND dm.status = 'ACTIVE'
ORDER BY st.id DESC;
"""


def extract_raw_data():
    print(
        f"[1/3] Kết nối CSDL MySQL Docker ({DB_CONFIG['host']}:{DB_CONFIG['port']}) & trích xuất..."
    )
    try:
        engine = get_db_engine()
        df_raw = pd.read_sql(SQL_QUERY, con=engine)

        RAW_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
        df_raw.to_csv(RAW_DATA_PATH, index=False, encoding="utf-8-sig")

        print(
            f"[2/3] Thành công: Trích xuất được {len(df_raw)} ca sửa chữa thô (1 phiếu = 1 dòng)."
        )
        print(f"[3/3] Đã lưu dữ liệu thô vào: {RAW_DATA_PATH}\n")

    except Exception as e:
        print(f"[error] Trích xuất thất bại: {e}")
        sys.exit(1)


if __name__ == "__main__":
    extract_raw_data()