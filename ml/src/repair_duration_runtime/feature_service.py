from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import pandas as pd

from repair_duration_data.catalog import internal_catalog_identity, normalize_catalog_service_label
from repair_duration_ml.config import FEATURE_COLUMNS
from repair_duration_ml.features import build_history_index, catalog_history_key
from .errors import RuntimeInferenceError
from .schemas import PredictionContext

VIETNAM = ZoneInfo("Asia/Ho_Chi_Minh")
WEEKDAYS = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


def normalize_evaluation_timestamp(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise RuntimeInferenceError("INVALID_EVALUATION_TIMESTAMP", "evaluationTimestamp must include a timezone offset")
    return value.astimezone(VIETNAM)


class RuntimeFeatureService:
    def build(self, context: PredictionContext, technician_ids: list[int], evaluation_timestamp: datetime,
              historical_rows: list[dict]) -> pd.DataFrame:
        at = normalize_evaluation_timestamp(evaluation_timestamp)
        normalized_history: list[dict] = []
        for source in historical_rows:
            row = dict(source)
            completed = pd.Timestamp(row["completed_at"])
            if completed.tzinfo is None:
                completed = completed.tz_localize(VIETNAM)
            else:
                completed = completed.tz_convert(VIETNAM)
            row["completed_at"] = completed
            normalized_history.append(row)
        history = build_history_index(normalized_history, at)
        label = normalize_catalog_service_label(context.catalog_service)
        base = {
            "device_type": context.device_type,
            "device_model": context.device_model,
            "service_issue": context.service_issue,
            "technical_action": context.technical_action,
            "is_warranty": int(context.is_warranty),
            "catalog_service": label,
            "internal_catalog_id": internal_catalog_identity(context.catalog_id),
            "standard_duration_minutes": int(context.standard_duration_minutes),
            "branch_id": f"BRANCH_{context.branch_id:02d}",
            "prediction_month": f"M{at.month:02d}",
            "prediction_weekday": WEEKDAYS[at.weekday()],
        }
        rows = []
        for technician_id in technician_ids:
            technician = f"TECH_{technician_id:02d}"
            row = {**base, "technician_id": technician}
            row.update(history.values(technician, context.service_issue, catalog_history_key(row)))
            rows.append({column: row[column] for column in FEATURE_COLUMNS})
        frame = pd.DataFrame(rows, columns=FEATURE_COLUMNS)
        if list(frame.columns) != FEATURE_COLUMNS:
            raise RuntimeInferenceError("FEATURE_CONTRACT_VIOLATION", "Runtime feature order is invalid", 500)
        return frame
