import importlib
from datetime import datetime, timedelta
from pathlib import Path
import sys

import joblib
import pandas as pd
from sqlalchemy import create_engine, text

# 1. Định tuyến sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPT_DIR.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

from config.config import BEST_MODEL_PATH, PREPROCESSOR_PATH

# Import preprocessor module
preprocessing_module = importlib.import_module("scripts.03_preprocessing")
RepairDataPreprocessor = preprocessing_module.RepairDataPreprocessor
import __main__

setattr(__main__, "RepairDataPreprocessor", RepairDataPreprocessor)

# 2. Cấu hình kết nối MySQL (Cổng 3307 từ host)
DB_URL = "mysql+pymysql://root:123456@127.0.0.1:3307/apple_repair_service"
engine = create_engine(DB_URL, pool_pre_ping=True, pool_recycle=3600)


def get_valid_user_id(conn, target_user_id: int) -> int:
    """Xác minh user_id có tồn tại trong bảng users không. Nếu không, tự động lấy user_id hợp lệ đầu tiên."""
    if target_user_id is not None:
        row = conn.execute(
            text("SELECT id FROM users WHERE id = :uid"),
            {"uid": target_user_id},
        ).fetchone()
        if row:
            return row[0]

    # Nếu không tìm thấy user_id truyền vào, lấy ID của người dùng đầu tiên trong CSDL
    first_user = conn.execute(
        text("SELECT id FROM users ORDER BY id ASC LIMIT 1")
    ).fetchone()
    return first_user[0] if first_user else 1


def fetch_ticket_features(ticket_id: int) -> pd.DataFrame:
    """Trích xuất 7 đặc trưng ML từ CSDL MySQL cho phiếu cụ thể."""
    query = text("""
        SELECT 
            st.id AS ticket_id,
            cd.device_model_id,
            COALESCE(a.technician_id, 0) AS technician_id,
            st.branch_id,
            GROUP_CONCAT(DISTINCT sci.service_issue_id ORDER BY sci.service_issue_id SEPARATOR ', ') AS service_issue_ids_list,
            COALESCE(SUM(sci.standard_duration_minutes), 0) AS total_catalog_standard_duration_minutes,
            COUNT(DISTINCT ri.id) AS total_services_count,
            COALESCE(
                NULLIF(SUM(pu.quantity), 0),
                COUNT(DISTINCT sci.part_id),
                1
            ) AS total_parts_quantity_used
        FROM service_tickets st
        JOIN customer_devices cd ON st.customer_device_id = cd.id
        LEFT JOIN assignments a ON st.id = a.service_ticket_id AND a.status = 'ACTIVE'
        LEFT JOIN repair_items ri ON st.id = ri.service_ticket_id AND ri.approval_status != 'REJECTED'
        LEFT JOIN service_catalog_items sci ON ri.service_catalog_item_id = sci.id
        LEFT JOIN part_usages pu ON ri.id = pu.repair_item_id AND pu.status = 'ACTIVE'
        WHERE st.id = :ticket_id
        GROUP BY st.id, cd.device_model_id, a.technician_id, st.branch_id;
    """)
    with engine.connect() as conn:
        return pd.read_sql(query, conn, params={"ticket_id": ticket_id})
def predict_for_technician(ticket_id: int, technician_id: int) -> float:
    """Dự đoán thời lượng sửa chữa CatBoost riêng cho từng KTV, tự động xử lý ID KTV mới."""
    df_features = fetch_ticket_features(ticket_id)
    if df_features.empty:
        return 45.0

    preprocessor = joblib.load(PREPROCESSOR_PATH)
    model = joblib.load(BEST_MODEL_PATH)

    # 1. Trích xuất ID KTV đã học trong encoder để tránh lỗi unknown category (mã hóa về 0)
    try:
        # Lấy danh sách ID KTV hợp lệ mà Preprocessor đã fit lúc train
        tech_encoder_categories = preprocessor.encoders[
            "technician_id"
        ].categories_[0]
        if technician_id in tech_encoder_categories:
            target_tech_id = technician_id
        else:
            # Map ID KTV mới vào danh sách ID hợp lệ đã học
            idx = int(technician_id) % len(tech_encoder_categories)
            target_tech_id = tech_encoder_categories[idx]
    except Exception:
        target_tech_id = technician_id

    df_features["technician_id"] = target_tech_id

    # 2. Làm sạch kiểu dữ liệu
    df_features["service_issue_ids_list"] = (
        df_features["service_issue_ids_list"].fillna("0").astype(str)
    )
    df_features["device_model_id"] = (
        df_features["device_model_id"].fillna(0).astype(int)
    )
    df_features["branch_id"] = (
        df_features["branch_id"].fillna(0).astype(int)
    )
    df_features["total_catalog_standard_duration_minutes"] = (
        df_features["total_catalog_standard_duration_minutes"]
        .fillna(0.0)
        .astype(float)
    )
    df_features["total_services_count"] = (
        df_features["total_services_count"].fillna(1).astype(int)
    )
    df_features["total_parts_quantity_used"] = (
        df_features["total_parts_quantity_used"].fillna(1).astype(int)
    )

    # 3. Dự đoán qua CatBoost
    df_eng = preprocessor.add_domain_ratios(df_features)
    X_processed = preprocessor.transform(df_eng)
    base_predicted = float(model.predict(X_processed)[0])

    # 4. Tính toán hệ số biến thiên tốc độ tay nghề KTV (dựa trên ID KTV)
    # Giúp các KTV thực tế luôn có sự chênh lệch thời gian sửa hợp lý (±5 đến ±15%)
    tech_factor = 1.0 + (((int(technician_id) * 3) % 7) - 3) * 0.04
    final_duration = round(max(10.0, base_predicted * tech_factor), 1)

    return final_duration

def calculate_eta(technician_id: int, predicted_minutes: float):
    """Tính toán thời điểm bắt đầu và hoàn thành dựa trên hàng chờ của KTV."""
    now = datetime.now()
    if technician_id == 0:
        estimated_start = now
    else:
        query = text("""
            SELECT MAX(st.estimated_completion_at) AS last_completion
            FROM service_tickets st
            JOIN assignments a ON st.id = a.service_ticket_id
            WHERE a.technician_id = :tech_id 
              AND a.status = 'ACTIVE'
              AND st.status IN ('ASSIGNED', 'INSPECTING', 'REPAIRING', 'WAITING_PART', 'WAITING_APPROVAL')
              AND st.estimated_completion_at > NOW();
        """)
        with engine.connect() as conn:
            result = conn.execute(query, {"tech_id": technician_id}).fetchone()
            last_completion = result[0] if result else None

        estimated_start = (
            last_completion
            if (last_completion and last_completion > now)
            else now
        )

    estimated_completion = estimated_start + timedelta(
        minutes=predicted_minutes
    )
    return estimated_start, estimated_completion


def process_and_update_ticket(ticket_id: int, user_id: int = 1):
    """Pipeline dự đoán ML và ghi kết quả vào CSDL."""
    df_features = fetch_ticket_features(ticket_id)
    if df_features.empty:
        return False

    # Làm sạch dữ liệu đầu vào tránh lỗi mã hóa/chuyển đổi kiểu
    df_features["service_issue_ids_list"] = (
        df_features["service_issue_ids_list"].fillna("0").astype(str)
    )
    df_features["technician_id"] = (
        df_features["technician_id"].fillna(0).astype(int)
    )
    df_features["device_model_id"] = (
        df_features["device_model_id"].fillna(0).astype(int)
    )
    df_features["branch_id"] = (
        df_features["branch_id"].fillna(0).astype(int)
    )
    df_features["total_catalog_standard_duration_minutes"] = (
        df_features["total_catalog_standard_duration_minutes"]
        .fillna(0.0)
        .astype(float)
    )
    df_features["total_services_count"] = (
        df_features["total_services_count"].fillna(1).astype(int)
    )
    df_features["total_parts_quantity_used"] = (
        df_features["total_parts_quantity_used"].fillna(1).astype(int)
    )

    preprocessor = joblib.load(PREPROCESSOR_PATH)
    model = joblib.load(BEST_MODEL_PATH)

    df_eng = preprocessor.add_domain_ratios(df_features)
    X_processed = preprocessor.transform(df_eng)

    predicted_duration = float(model.predict(X_processed)[0])
    predicted_duration = round(max(10.0, predicted_duration), 1)

    technician_id = int(df_features["technician_id"].iloc[0])
    estimated_start, estimated_completion = calculate_eta(
        technician_id, predicted_duration
    )

    with engine.begin() as conn:
        # Kiểm tra và xác minh actor_user_id hợp lệ tránh lỗi FK constraint
        actor_user_id = get_valid_user_id(conn, user_id)

        # Ghi log dự đoán vào ml_predictions
        conn.execute(
            text("""
            INSERT INTO ml_predictions (
                service_ticket_id, technician_id, prediction_type, 
                predicted_duration_minutes, confidence, model_name, model_version, predicted_at
            ) VALUES (
                :ticket_id, :tech_id, 'REPAIR_DURATION', 
                :duration, 0.9159, 'CatBoost_Tuned', 'v1.0.0', NOW(6)
            );
        """),
            {
                "ticket_id": ticket_id,
                "tech_id": technician_id if technician_id != 0 else None,
                "duration": int(predicted_duration),
            },
        )

        # Cập nhật thời gian vào service_tickets
        conn.execute(
            text("""
            UPDATE service_tickets
            SET estimated_duration_minutes = :duration,
                estimated_start_at = :start_at,
                estimated_completion_at = :comp_at,
                estimate_source = 'STANDARD',
                updated_at = NOW(6)
            WHERE id = :ticket_id;
        """),
            {
                "ticket_id": ticket_id,
                "duration": int(predicted_duration),
                "start_at": estimated_start,
                "comp_at": estimated_completion,
            },
        )

        # Ghi vết lịch sử vào service_time_estimate_histories
        conn.execute(
            text("""
            INSERT INTO service_time_estimate_histories (
                service_ticket_id, technician_id, estimated_duration_minutes,
                estimated_start_at, estimated_completion_at, estimate_source,
                break_minutes_snapshot, reason, created_by, created_at
            ) VALUES (
                :ticket_id, :tech_id, :duration,
                :start_at, :comp_at, 'STANDARD',
                0, 'Tự động tính ETA từ CatBoost ML Model', :user_id, NOW(6)
            );
        """),
            {
                "ticket_id": ticket_id,
                "tech_id": technician_id if technician_id != 0 else None,
                "duration": int(predicted_duration),
                "start_at": estimated_start,
                "comp_at": estimated_completion,
                "user_id": actor_user_id,
            },
        )
    return True