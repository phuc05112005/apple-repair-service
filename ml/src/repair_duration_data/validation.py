"""Fail-fast validation for the frozen 24-column real dataset."""

from __future__ import annotations

import pandas as pd

from repair_duration_ml.config import FEATURE_COLUMNS, FORBIDDEN_COLUMNS, INTENTIONAL_MISSING_COLUMNS, OUTPUT_COLUMNS, TARGET


def validate_real_dataset(frame: pd.DataFrame) -> None:
    if list(frame.columns) != OUTPUT_COLUMNS:
        raise ValueError("Output columns do not match the frozen contract")
    if len(FEATURE_COLUMNS) != 20:
        raise ValueError("Frozen feature contract must contain exactly 20 features")
    if frame["sample_id"].duplicated().any():
        raise ValueError("Duplicate sample_id")
    if FORBIDDEN_COLUMNS.intersection(frame.columns):
        raise ValueError("Dataset contains a forbidden/leakage/PII column")
    if frame.empty:
        return
    if (frame[TARGET] <= 0).any():
        raise ValueError("Target must be positive")
    if not frame["technical_action"].isin(["REPAIR", "REPLACEMENT"]).all():
        raise ValueError("technical_action must be REPAIR or REPLACEMENT")
    if not frame["is_warranty"].isin([0, 1]).all():
        raise ValueError("is_warranty must be binary")
    if (frame["standard_duration_minutes"] <= 0).any():
        raise ValueError("standard_duration_minutes must be positive")
    predicted = pd.to_datetime(frame["prediction_timestamp"], errors="coerce")
    completed = pd.to_datetime(frame["completed_at"], errors="coerce")
    if predicted.isna().any() or completed.isna().any() or not (completed > predicted).all():
        raise ValueError("Invalid prediction/completion timeline")
    count_to_stats = {
        "technician_jobs_completed_before": ("technician_average_duration_before", "technician_historical_efficiency_before"),
        "technician_issue_jobs_before": ("technician_issue_average_duration_before", "technician_issue_efficiency_before"),
        "technician_catalog_jobs_before": ("technician_catalog_average_duration_before", "technician_catalog_efficiency_before"),
    }
    for count, statistics in count_to_stats.items():
        if (frame[count] < 0).any():
            raise ValueError(f"{count} must be non-negative")
        cold = frame[count] == 0
        if any(frame.loc[cold, statistic].notna().any() for statistic in statistics):
            raise ValueError(f"Cold-start statistics for {count} must remain missing")
    unexpected_missing = [column for column in frame.columns if column not in INTENTIONAL_MISSING_COLUMNS and frame[column].isna().any()]
    if unexpected_missing:
        raise ValueError("Unexpected missing values: " + ", ".join(unexpected_missing))
