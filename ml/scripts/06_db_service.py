import os
import sys
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path

import pandas as pd
from sqlalchemy import text

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

from config.config import DEFAULT_ESTIMATE_MINUTES
from src.inference import (load_bundle, predict_for_technician_ids, predict_mean_over_technicians,
                           predict_minutes)
from src.sql_features import services_subquery


@lru_cache(maxsize=1)
def get_engine():
    from sqlalchemy import create_engine
    host = os.getenv("DB_HOST") or os.getenv("MYSQL_HOST") or "127.0.0.1"
    port = os.getenv("DB_PORT") or os.getenv("MYSQL_PORT") or "3307"
    name = os.getenv("DB_NAME") or os.getenv("MYSQL_DATABASE") or "apple_repair_service"
    user = os.getenv("DB_USER") or os.getenv("MYSQL_USER") or "root"
    pwd = os.getenv("DB_PASSWORD") or os.getenv("MYSQL_PASSWORD") or "123456"
    return create_engine(f"mysql+pymysql://{user}:{pwd}@{host}:{port}/{name}", pool_pre_ping=True, pool_recycle=3600)


FEATURE_QUERY = text(f"""
    SELECT
        st.id AS ticket_id,
        st.branch_id,
        cd.device_model_id,
        COALESCE(a.technician_id, 0) AS technician_id,
        COALESCE(sv.total_services_count, 0) AS total_services_count,
        sv.service_issue_ids_list,
        COALESCE(sv.total_catalog_standard_duration_minutes, 0) AS total_catalog_standard_duration_minutes
    FROM service_tickets st
    JOIN customer_devices cd ON st.customer_device_id = cd.id
    LEFT JOIN assignments a ON st.id = a.service_ticket_id AND a.status = 'ACTIVE'
    LEFT JOIN ({services_subquery("AND ri.service_ticket_id = :ticket_id")}) sv ON st.id = sv.service_ticket_id
    WHERE st.id = :ticket_id
""")


def fetch_ticket_features(ticket_id: int, service_catalog_item_ids: list[int] | None = None) -> pd.DataFrame:
    with get_engine().connect() as conn:
        if not service_catalog_item_ids:
            return pd.read_sql(FEATURE_QUERY, conn, params={"ticket_id": ticket_id})

        ticket_query = text("""
            SELECT
                st.id AS ticket_id,
                st.branch_id,
                cd.device_model_id,
                COALESCE(a.technician_id, 0) AS technician_id
            FROM service_tickets st
            JOIN customer_devices cd ON st.customer_device_id = cd.id
            LEFT JOIN assignments a ON st.id = a.service_ticket_id AND a.status = 'ACTIVE'
            WHERE st.id = :ticket_id
        """)
        df_ticket = pd.read_sql(ticket_query, conn, params={"ticket_id": ticket_id})
        if df_ticket.empty:
            return df_ticket

        placeholders = ", ".join(f":cid_{i}" for i in range(len(service_catalog_item_ids)))
        cid_params = {f"cid_{i}": int(cid) for i, cid in enumerate(service_catalog_item_ids)}
        catalog_query = text(f"""
            SELECT
                COUNT(*) AS total_services_count,
                GROUP_CONCAT(sci.service_issue_id ORDER BY sci.id SEPARATOR ',') AS service_issue_ids_list,
                COALESCE(SUM(sci.standard_duration_minutes), 0) AS total_catalog_standard_duration_minutes
            FROM service_catalog_items sci
            WHERE sci.id IN ({placeholders})
        """)
        df_sv = pd.read_sql(catalog_query, conn, params=cid_params)
        df_ticket["total_services_count"] = int(df_sv["total_services_count"].iloc[0])
        df_ticket["service_issue_ids_list"] = df_sv["service_issue_ids_list"].iloc[0]
        df_ticket["total_catalog_standard_duration_minutes"] = float(df_sv["total_catalog_standard_duration_minutes"].iloc[0])
        return df_ticket


def _warnings(features: pd.DataFrame, bundle, technician_id: int | None) -> list[str]:
    w = []
    total_services = int(features["total_services_count"].iloc[0])
    total_catalog = float(features["total_catalog_standard_duration_minutes"].iloc[0])

    if total_services == 0:
        w.append("NO_REPAIR_ITEMS")
    if total_catalog < 30 or total_catalog > 225:
        w.append("CATALOG_OUT_OF_BOUNDS")
    if total_services >= 4:
        w.append("TOO_MANY_SERVICES")

    unk = bundle.builder.unknown_values(
        features.assign(technician_id=technician_id if technician_id is not None else features["technician_id"])
    )
    if "technician_id" in unk:
        w.append("UNKNOWN_TECHNICIAN")
    if "device_model_id" in unk:
        w.append("UNKNOWN_DEVICE_MODEL")
    if "issue_ids" in unk:
        w.append("UNKNOWN_SERVICE_ISSUE")
    return w


def predict_candidates(ticket_id: int, candidate_ids: list[int], service_catalog_item_ids: list[int] | None = None) -> list[dict]:
    features = fetch_ticket_features(ticket_id, service_catalog_item_ids)
    if features.empty:
        raise LookupError(f"Không tìm thấy phiếu #{ticket_id}")
    bundle = load_bundle()

    if int(features["total_services_count"].iloc[0]) == 0:
        return [{"technician_id": int(t), "predicted_minutes": DEFAULT_ESTIMATE_MINUTES, "lower_minutes": None,
                 "upper_minutes": None, "warnings": ["NO_REPAIR_ITEMS"]} for t in candidate_ids]

    res = predict_for_technician_ids(features, [int(t) for t in candidate_ids], bundle)
    out = []
    for _, r in res.iterrows():
        t_id = int(r["technician_id"])
        tech_warnings = _warnings(features, bundle, t_id)
        out.append({
            "technician_id": t_id,
            "predicted_minutes": float(r["predicted_minutes"]),
            "lower_minutes": float(r["lower_minutes"]),
            "upper_minutes": float(r["upper_minutes"]),
            "warnings": tech_warnings
        })
    return out


def predict_for_technician(ticket_id: int, technician_id: int) -> float:
    return predict_candidates(ticket_id, [technician_id])[0]["predicted_minutes"]


def calculate_eta(technician_id: int, predicted_minutes: float):
    now = datetime.now()
    start = now
    if technician_id != 0:
        query = text("""
            SELECT MAX(st.estimated_completion_at) AS last_completion
            FROM service_tickets st JOIN assignments a ON st.id = a.service_ticket_id
            WHERE a.technician_id = :tech_id AND a.status = 'ACTIVE'
              AND st.status IN ('ASSIGNED','INSPECTING','REPAIRING','WAITING_PART','WAITING_APPROVAL')
              AND st.estimated_completion_at > NOW();
        """)
        with get_engine().connect() as conn:
            row = conn.execute(query, {"tech_id": technician_id}).fetchone()
        last = row[0] if row else None
        start = last if (last and last > now) else now
    return start, start + timedelta(minutes=predicted_minutes)


def recommend_technician(ticket_id: int, candidate_ids: list[int]) -> list[dict]:
    ranked = []
    for p in predict_candidates(ticket_id, candidate_ids):
        start, done = calculate_eta(p["technician_id"], p["predicted_minutes"])
        ranked.append({**p, "estimated_start_at": start, "estimated_completion_at": done})
    return sorted(ranked, key=lambda r: r["estimated_completion_at"])


def get_valid_user_id(conn, target_user_id: int) -> int:
    if target_user_id is not None:
        row = conn.execute(text("SELECT id FROM users WHERE id = :uid"), {"uid": target_user_id}).fetchone()
        if row:
            return row[0]
    first = conn.execute(text("SELECT id FROM users ORDER BY id ASC LIMIT 1")).fetchone()
    return first[0] if first else 1


def process_and_update_ticket(ticket_id: int, user_id: int = 1) -> bool:
    features = fetch_ticket_features(ticket_id)
    if features.empty:
        return False
    bundle = load_bundle()
    md = bundle.metadata
    technician_id = int(features["technician_id"].iloc[0])

    if int(features["total_services_count"].iloc[0]) == 0:
        est = {"predicted_minutes": DEFAULT_ESTIMATE_MINUTES, "lower_minutes": None, "upper_minutes": None}
        source = 'STANDARD'
    elif technician_id == 0:
        est = predict_mean_over_technicians(features, bundle)
        source = 'ML'
    else:
        r = predict_minutes(features, bundle).iloc[0]
        est = {k: float(r[k]) for k in ("predicted_minutes", "lower_minutes", "upper_minutes")}
        source = 'ML'

    minutes = round(est["predicted_minutes"], 1)
    start, done = calculate_eta(technician_id, minutes)
    rng = (f" (khoảng {md['interval_coverage']:.0%}: {est['lower_minutes']:.0f}–{est['upper_minutes']:.0f} phút)"
           if est["lower_minutes"] is not None else " (chưa có hạng mục sửa chữa, dùng mặc định)")
    reason = f"ML {md['model_name']} {md['model_version']}: {minutes:.0f} phút{rng}"[:250]

    with get_engine().begin() as conn:
        actor = get_valid_user_id(conn, user_id)
        conn.execute(text("""
            INSERT INTO ml_predictions (service_ticket_id, technician_id, prediction_type,
                predicted_duration_minutes, confidence, model_name, model_version, predicted_at)
            VALUES (:ticket_id, :tech_id, 'REPAIR_DURATION', :duration, :confidence, :model_name, :model_version, NOW(6));
        """), {"ticket_id": ticket_id, "tech_id": technician_id or None, "duration": int(round(minutes)),
               "confidence": md["interval_coverage"],
               "model_name": md["model_name"], "model_version": md["model_version"]})
        conn.execute(text("""
            UPDATE service_tickets SET estimated_duration_minutes = :duration, estimated_start_at = :start_at,
                estimated_completion_at = :comp_at, estimate_source = :source, updated_at = NOW(6)
            WHERE id = :ticket_id;
        """), {"ticket_id": ticket_id, "duration": int(round(minutes)), "start_at": start, "comp_at": done, "source": source})
        conn.execute(text("""
            INSERT INTO service_time_estimate_histories (service_ticket_id, technician_id, estimated_duration_minutes,
                estimated_start_at, estimated_completion_at, estimate_source, break_minutes_snapshot, reason, created_by, created_at)
            VALUES (:ticket_id, :tech_id, :duration, :start_at, :comp_at, :source, 0, :reason, :user_id, NOW(6));
        """), {"ticket_id": ticket_id, "tech_id": technician_id or None, "duration": int(round(minutes)),
               "start_at": start, "comp_at": done, "source": source, "reason": reason, "user_id": actor})
    return True