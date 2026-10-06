"""Dataset validation, chronological splitting and baseline helpers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from .config import (
    FEATURE_COLUMNS,
    FORBIDDEN_COLUMNS,
    INTENTIONAL_MISSING_COLUMNS,
    OUTPUT_COLUMNS,
    TARGET,
    TEST_FRACTION,
    TIME_COLUMN,
)


@dataclass(frozen=True)
class TemporalDataSplit:
    development: pd.DataFrame
    test: pd.DataFrame
    split_index: int


def load_dataset(path: str | Path) -> pd.DataFrame:
    frame = pd.read_csv(path, parse_dates=[TIME_COLUMN, "completed_at"])
    validate_dataset(frame)
    return frame.sort_values(TIME_COLUMN, kind="stable").reset_index(drop=True)


def validate_dataset(frame: pd.DataFrame, expected_rows: int | None = None) -> None:
    if list(frame.columns) != OUTPUT_COLUMNS:
        missing = sorted(set(OUTPUT_COLUMNS) - set(frame.columns))
        extra = sorted(set(frame.columns) - set(OUTPUT_COLUMNS))
        raise ValueError(f"Unexpected dataset schema; missing={missing}, extra={extra}")
    if expected_rows is not None and len(frame) != expected_rows:
        raise ValueError(f"Expected {expected_rows} rows, found {len(frame)}")
    if frame.empty:
        raise ValueError("Dataset must contain at least one row")
    if not frame["sample_id"].is_unique or frame.duplicated().any():
        raise ValueError("Samples and sample_id values must be unique")
    if not frame[TIME_COLUMN].is_monotonic_increasing:
        raise ValueError("Rows must be sorted chronologically by prediction_timestamp")
    if (frame["completed_at"] <= frame[TIME_COLUMN]).any():
        raise ValueError("Every completion must occur after its prediction timestamp")
    if (frame[TARGET] <= 0).any() or not np.isfinite(frame[TARGET]).all():
        raise ValueError("Target must contain finite positive minutes")
    missing_columns = set(frame.columns[frame.isna().any()])
    if not missing_columns.issubset(INTENTIONAL_MISSING_COLUMNS):
        unexpected = sorted(missing_columns - INTENTIONAL_MISSING_COLUMNS)
        raise ValueError(f"Unexpected missing columns: {unexpected}")
    leaked = sorted(set(frame.columns) & FORBIDDEN_COLUMNS)
    if leaked:
        raise ValueError(f"Forbidden future/hidden columns found: {leaked}")
    if set(FEATURE_COLUMNS) & {"completed_at", TARGET}:
        raise AssertionError("Feature contract contains future outcome data")


def temporal_holdout_split(
    frame: pd.DataFrame, test_fraction: float = TEST_FRACTION
) -> TemporalDataSplit:
    if not 0.05 <= test_fraction <= 0.40:
        raise ValueError("test_fraction must be between 0.05 and 0.40")
    ordered = frame.sort_values(TIME_COLUMN, kind="stable").reset_index(drop=True)
    split_index = int(np.floor(len(ordered) * (1.0 - test_fraction)))
    if split_index < 20 or len(ordered) - split_index < 5:
        raise ValueError("Dataset is too small for a chronological development/test split")
    development = ordered.iloc[:split_index].copy()
    test = ordered.iloc[split_index:].copy()
    if development[TIME_COLUMN].max() > test[TIME_COLUMN].min():
        raise AssertionError("Temporal holdout overlaps development")
    return TemporalDataSplit(development, test, split_index)


def feature_target(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    return frame[FEATURE_COLUMNS].copy(), frame[TARGET].astype(float).copy()


def mean_baseline(train_y: pd.Series, size: int) -> np.ndarray:
    return np.full(size, float(train_y.mean()), dtype=float)


def standard_duration_baseline(frame: pd.DataFrame) -> np.ndarray:
    return frame["standard_duration_minutes"].to_numpy(dtype=float, copy=True)
