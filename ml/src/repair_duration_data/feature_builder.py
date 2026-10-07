"""Shared offline/future-runtime feature semantics for repair duration."""

from __future__ import annotations

import pandas as pd

from repair_duration_ml.features import attach_historical_features

from .catalog import internal_catalog_identity, normalize_catalog_service_label
from .eligibility import EligibleSample

WEEKDAYS = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


def build_base_feature_row(sample: EligibleSample) -> dict:
    predicted_at = pd.Timestamp(sample.assignment["assigned_at"])
    ticket = sample.ticket
    return {
        "sample_id": f"REAL_TICKET_{int(ticket['ticket_id']):08d}",
        "prediction_timestamp": predicted_at,
        "completed_at": pd.Timestamp(ticket["actual_repair_completed_at"]),
        "device_type": str(ticket["device_type"]),
        "device_model": str(ticket["device_model"]),
        "service_issue": str(sample.item["service_issue"]),
        "technical_action": sample.technical_action,
        "is_warranty": int(sample.item.get("warranty_source_item_id") is not None),
        "catalog_service": normalize_catalog_service_label(sample.catalog_name),
        "internal_catalog_id": internal_catalog_identity(sample.catalog_id),
        "standard_duration_minutes": sample.standard_duration_minutes,
        "technician_id": f"TECH_{int(sample.assignment['technician_id']):02d}",
        "branch_id": f"BRANCH_{int(ticket['branch_id']):02d}",
        "prediction_month": f"M{predicted_at.month:02d}",
        "prediction_weekday": WEEKDAYS[predicted_at.weekday()],
        "actual_technical_minutes": sample.target_minutes,
    }


def build_feature_dataset(samples: list[EligibleSample]) -> pd.DataFrame:
    rows = [build_base_feature_row(sample) for sample in samples]
    rows.sort(key=lambda row: (row["prediction_timestamp"], row["sample_id"]))
    return attach_historical_features(rows)
