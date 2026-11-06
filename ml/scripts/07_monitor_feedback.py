"""Bước 7: VÒNG PHẢN HỒI. So dự đoán đã ghi trong ml_predictions với thời gian sửa thực tế khi phiếu hoàn tất.
Chạy định kỳ (cron/hằng tuần). Cho biết model còn đáng tin không và khi nào cần train lại."""
import sys
from pathlib import Path

import pandas as pd

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

FEEDBACK_SQL = """
SELECT mp.id AS prediction_id, mp.service_ticket_id, mp.technician_id, mp.predicted_duration_minutes,
       mp.model_version, mp.predicted_at,
       (TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at)
        - COALESCE(p.pause_min, 0)) AS actual_net_minutes
FROM ml_predictions mp
JOIN service_tickets st ON st.id = mp.service_ticket_id
LEFT JOIN (
    SELECT service_ticket_id, SUM(TIMESTAMPDIFF(MINUTE, changed_at, resolved_at)) AS pause_min
    FROM service_status_histories
    WHERE to_status IN ('WAITING_PART', 'WAITING_APPROVAL') AND resolved_at IS NOT NULL
    GROUP BY service_ticket_id
) p ON p.service_ticket_id = st.id
WHERE mp.prediction_type = 'REPAIR_DURATION'
  AND st.actual_repair_started_at IS NOT NULL AND st.actual_repair_completed_at IS NOT NULL
"""


def summarize(df: pd.DataFrame, metadata: dict, min_rows: int = 30) -> dict:
    """Thuần pandas (dễ kiểm thử). Mỗi phiếu chỉ lấy dự đoán MỚI NHẤT; bỏ ca thực tế <= 0."""
    d = (df.sort_values("predicted_at").drop_duplicates("service_ticket_id", keep="last")
           .query("actual_net_minutes > 0").copy())
    if len(d) < min_rows:
        return {"status": "NOT_ENOUGH_DATA", "n": int(len(d)), "need": min_rows}
    err = d["predicted_duration_minutes"] - d["actual_net_minutes"]
    mae, ref = float(err.abs().mean()), float(metadata["test_metrics"]["MAE"])
    q = float(metadata["interval_halfwidth_minutes"])
    out = {"n": int(len(d)), "MAE_live": round(mae, 2), "MAE_at_training_test": round(ref, 2),
           "bias_live": round(float(err.mean()), 2), "interval_coverage_live": round(float((err.abs() <= q).mean()), 3),
           "interval_coverage_nominal": metadata["interval_coverage"],
           "by_technician_MAE": d.assign(abs_err=err.abs()).groupby("technician_id")["abs_err"].mean().round(2).to_dict()}
    out["status"] = "RETRAIN_RECOMMENDED" if mae > 1.5 * ref else "OK"
    return out


if __name__ == "__main__":
    import importlib
    from src.inference import load_bundle
    svc = importlib.import_module("scripts.06_db_service")
    with svc.get_engine().connect() as conn:
        frame = pd.read_sql(FEEDBACK_SQL, conn)
    print(summarize(frame, load_bundle().metadata))
