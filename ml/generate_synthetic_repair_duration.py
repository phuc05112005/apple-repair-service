"""Generate the controlled V1 repair-duration regression dataset.

The generator mirrors fields and relationships that exist in the Apple Repair
Service schema. All values are synthetic. It never reads or writes the business
database. Historical technician features are calculated strictly as-of each
prediction timestamp from jobs that had already completed.
"""

from __future__ import annotations

import argparse
import heapq
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


SEED = 20261005
N_SAMPLES = 5_000
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "data" / "synthetic_repair_duration_v1.csv"

FEATURE_COLUMNS = [
    "device_type",
    "device_model",
    "service_issue",
    "service_type",
    "catalog_service",
    "standard_duration_minutes",
    "technician_id",
    "branch_id",
    "prediction_month",
    "prediction_weekday",
    "technician_jobs_completed_before",
    "technician_average_duration_before",
    "technician_issue_experience_before",
    "technician_historical_efficiency_before",
]

OUTPUT_COLUMNS = [
    "sample_id",
    "prediction_timestamp",
    "completed_at",
    *FEATURE_COLUMNS,
    "actual_technical_minutes",
]


CATALOG = [
    # Controlled synthetic master data compatible with device_types,
    # device_models, service_issues, service_types and service_catalog_items.
    ("iPhone", "iPhone 13", "Pin", "REPLACEMENT", "Thay pin iPhone 13", 60, 1.15),
    ("iPhone", "iPhone 13", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 13", 105, 0.85),
    ("iPhone", "iPhone 13", "Cổng sạc", "REPAIR", "Sửa cổng sạc iPhone 13", 80, 0.70),
    ("iPhone", "iPhone 14", "Pin", "REPLACEMENT", "Thay pin iPhone 14", 65, 1.10),
    ("iPhone", "iPhone 14", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 14", 110, 0.85),
    ("iPhone", "iPhone 14", "Camera", "REPLACEMENT", "Thay camera iPhone 14", 75, 0.55),
    ("iPhone", "iPhone 15 Pro", "Pin", "REPLACEMENT", "Thay pin iPhone 15 Pro", 70, 0.95),
    ("iPhone", "iPhone 15 Pro", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 15 Pro", 120, 0.75),
    ("iPhone", "iPhone 15 Pro", "Mainboard", "REPAIR", "Sửa mainboard iPhone 15 Pro", 210, 0.40),
    ("iPhone", "iPhone 16 Pro", "Pin", "REPLACEMENT", "Thay pin iPhone 16 Pro", 75, 0.90),
    ("iPhone", "iPhone 16 Pro", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 16 Pro", 125, 0.70),
    ("iPhone", "iPhone 16 Pro", "Pin", "WARRANTY", "Xử lý bảo hành pin iPhone 16 Pro", 70, 0.35),
    ("iPad", "iPad 10", "Pin", "REPLACEMENT", "Thay pin iPad 10", 120, 0.60),
    ("iPad", "iPad 10", "Màn hình", "REPLACEMENT", "Thay màn hình iPad 10", 150, 0.52),
    ("iPad", "iPad 10", "Cổng sạc", "REPAIR", "Sửa cổng sạc iPad 10", 100, 0.42),
    ("iPad", "iPad Air M2", "Pin", "REPLACEMENT", "Thay pin iPad Air M2", 130, 0.48),
    ("iPad", "iPad Air M2", "Màn hình", "WARRANTY", "Xử lý bảo hành màn hình iPad Air M2", 145, 0.28),
    ("MacBook", "MacBook Air M1", "Pin", "REPLACEMENT", "Thay pin MacBook Air M1", 130, 0.65),
    ("MacBook", "MacBook Air M1", "Bàn phím", "REPLACEMENT", "Thay bàn phím MacBook Air M1", 190, 0.38),
    ("MacBook", "MacBook Air M1", "Mainboard", "REPAIR", "Sửa mainboard MacBook Air M1", 240, 0.34),
    ("MacBook", "MacBook Air M2", "Pin", "REPLACEMENT", "Thay pin MacBook Air M2", 140, 0.55),
    ("MacBook", "MacBook Air M2", "Màn hình", "REPLACEMENT", "Thay màn hình MacBook Air M2", 210, 0.34),
    ("MacBook", "MacBook Pro 14", "Bàn phím", "REPAIR", "Sửa bàn phím MacBook Pro 14", 170, 0.30),
    ("MacBook", "MacBook Pro 14", "Mainboard", "WARRANTY", "Xử lý bảo hành mainboard MacBook Pro 14", 260, 0.24),
]

TECHNICIANS = [f"TECH_{number:02d}" for number in range(1, 13)]
BRANCHES = ["BRANCH_01", "BRANCH_02", "BRANCH_03"]
ISSUES = sorted({row[2] for row in CATALOG})


@dataclass
class RunningHistory:
    jobs: int = 0
    duration_sum: float = 0.0
    efficiency_sum: float = 0.0

    def update(self, duration: float, standard: float) -> None:
        self.jobs += 1
        self.duration_sum += duration
        self.efficiency_sum += duration / standard


def _prediction_timestamps(rng: np.random.Generator, n_samples: int) -> pd.DatetimeIndex:
    business_days = pd.bdate_range("2025-01-02", "2026-09-29")
    day_indexes = rng.integers(0, len(business_days), size=n_samples)
    minute_offsets = rng.integers(8 * 60, 18 * 60, size=n_samples)
    timestamps = business_days[day_indexes] + pd.to_timedelta(minute_offsets, unit="m")
    return pd.DatetimeIndex(timestamps).sort_values()


def _latent_configuration(rng: np.random.Generator) -> tuple[dict, dict, dict]:
    technician_speed = {
        technician: float(speed)
        for technician, speed in zip(TECHNICIANS, rng.uniform(0.80, 1.23, len(TECHNICIANS)))
    }
    technician_specialties = {
        technician: set(rng.choice(ISSUES, size=2, replace=False).tolist())
        for technician in TECHNICIANS
    }
    technician_branch = {
        technician: BRANCHES[index % len(BRANCHES)]
        for index, technician in enumerate(TECHNICIANS)
    }
    return technician_speed, technician_specialties, technician_branch


def _raw_jobs(rng: np.random.Generator, n_samples: int) -> list[dict]:
    timestamps = _prediction_timestamps(rng, n_samples)
    weights = np.asarray([row[6] for row in CATALOG], dtype=float)
    weights /= weights.sum()
    technician_speed, specialties, home_branch = _latent_configuration(rng)
    technician_start = {
        technician: pd.Timestamp("2025-01-01") + pd.Timedelta(days=35 * index)
        for index, technician in enumerate(TECHNICIANS)
    }
    branch_factors = {"BRANCH_01": 0.97, "BRANCH_02": 1.03, "BRANCH_03": 1.07}
    service_factors = {"REPAIR": 1.04, "REPLACEMENT": 0.98, "WARRANTY": 1.08}
    rows: list[dict] = []

    for index, prediction_at in enumerate(timestamps):
        catalog_index = int(rng.choice(len(CATALOG), p=weights))
        device_type, device_model, issue, service_type, service_name, standard, _ = CATALOG[catalog_index]
        branch = str(rng.choice(BRANCHES, p=[0.45, 0.35, 0.20]))
        active_technicians = [
            technician for technician in TECHNICIANS if technician_start[technician] <= prediction_at
        ]
        technician_weights = np.asarray(
            [
                (1.65 if home_branch[technician] == branch else 0.55)
                * (1.35 if issue in specialties[technician] else 1.0)
                for technician in active_technicians
            ],
            dtype=float,
        )
        technician_weights /= technician_weights.sum()
        technician = str(rng.choice(active_technicians, p=technician_weights))

        specialty_factor = 0.88 if issue in specialties[technician] else 1.04
        seasonal_factor = 1.0 + 0.035 * np.sin((prediction_at.month - 1) / 12 * 2 * np.pi)
        ordinary_noise = float(rng.lognormal(mean=-0.5 * 0.20**2, sigma=0.20))
        complexity_factor = float(rng.uniform(1.22, 1.55)) if rng.random() < 0.08 else 1.0
        outlier_draw = rng.random()
        outlier_factor = float(rng.uniform(1.55, 2.25)) if outlier_draw < 0.018 else 1.0
        if outlier_draw > 0.995:
            outlier_factor = float(rng.uniform(0.62, 0.78))

        hidden_duration = (
            standard
            * technician_speed[technician]
            * specialty_factor
            * branch_factors[branch]
            * service_factors[service_type]
            * seasonal_factor
            * ordinary_noise
            * complexity_factor
            * outlier_factor
        )
        actual_duration = int(np.clip(np.rint(hidden_duration), 10, 600))
        non_technical_elapsed = int(rng.gamma(shape=1.7, scale=24.0))
        completed_at = prediction_at + pd.Timedelta(
            minutes=actual_duration + non_technical_elapsed
        )
        rows.append(
            {
                "sample_id": f"SYN_RD_{index + 1:06d}",
                "prediction_timestamp": prediction_at,
                "completed_at": completed_at,
                "device_type": device_type,
                "device_model": device_model,
                "service_issue": issue,
                "service_type": service_type,
                "catalog_service": service_name,
                "standard_duration_minutes": standard,
                "technician_id": technician,
                "branch_id": branch,
                "prediction_month": f"M{prediction_at.month:02d}",
                "prediction_weekday": prediction_at.day_name()[:3].upper(),
                "actual_technical_minutes": actual_duration,
            }
        )
    return rows


def attach_historical_features(rows: list[dict]) -> pd.DataFrame:
    """Attach leakage-safe history using only jobs completed before prediction."""
    technician_history: defaultdict[str, RunningHistory] = defaultdict(RunningHistory)
    issue_history: defaultdict[tuple[str, str], int] = defaultdict(int)
    pending: list[tuple[pd.Timestamp, int, dict]] = []
    enriched: list[dict] = []

    for sequence, row in enumerate(rows):
        prediction_at = pd.Timestamp(row["prediction_timestamp"])
        while pending and pending[0][0] < prediction_at:
            _, _, completed = heapq.heappop(pending)
            technician = completed["technician_id"]
            technician_history[technician].update(
                completed["actual_technical_minutes"], completed["standard_duration_minutes"]
            )
            issue_history[(technician, completed["service_issue"])] += 1

        history = technician_history[row["technician_id"]]
        current = dict(row)
        current["technician_jobs_completed_before"] = history.jobs
        current["technician_average_duration_before"] = (
            history.duration_sum / history.jobs if history.jobs else np.nan
        )
        current["technician_issue_experience_before"] = issue_history[
            (row["technician_id"], row["service_issue"])
        ]
        current["technician_historical_efficiency_before"] = (
            history.efficiency_sum / history.jobs if history.jobs else np.nan
        )
        enriched.append(current)
        heapq.heappush(pending, (pd.Timestamp(row["completed_at"]), sequence, row))

    frame = pd.DataFrame(enriched, columns=OUTPUT_COLUMNS)
    frame["prediction_timestamp"] = pd.to_datetime(frame["prediction_timestamp"])
    frame["completed_at"] = pd.to_datetime(frame["completed_at"])
    return frame


def validate_dataset(frame: pd.DataFrame, expected_rows: int) -> None:
    if list(frame.columns) != OUTPUT_COLUMNS:
        raise ValueError("Unexpected dataset schema")
    if len(frame) != expected_rows:
        raise ValueError(f"Expected {expected_rows} rows, found {len(frame)}")
    if not frame["sample_id"].is_unique or frame.duplicated().any():
        raise ValueError("Synthetic samples must be unique")
    if not frame["prediction_timestamp"].is_monotonic_increasing:
        raise ValueError("Samples must be chronological")
    if (frame["completed_at"] <= frame["prediction_timestamp"]).any():
        raise ValueError("Completion must occur after prediction")
    if (frame["actual_technical_minutes"] <= 0).any():
        raise ValueError("Target must be positive")
    allowed_missing = {
        "technician_average_duration_before",
        "technician_historical_efficiency_before",
    }
    unexpected_missing = set(frame.columns[frame.isna().any()]) - allowed_missing
    if unexpected_missing:
        raise ValueError(f"Unexpected missing columns: {sorted(unexpected_missing)}")
    if set(frame.columns) & {
        "technician_speed_factor",
        "complexity_factor",
        "outlier_factor",
    }:
        raise ValueError("Hidden generator parameters leaked into the dataset")


def generate_dataset(n_samples: int = N_SAMPLES, seed: int = SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    frame = attach_historical_features(_raw_jobs(rng, n_samples))
    validate_dataset(frame, n_samples)
    return frame


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=int, default=N_SAMPLES)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    dataset = generate_dataset(args.rows, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_csv(args.output, index=False, date_format="%Y-%m-%dT%H:%M:%S")
    print(f"Wrote {len(dataset)} rows to {args.output}")
    print(
        "Range:",
        dataset["prediction_timestamp"].min().isoformat(),
        "->",
        dataset["completed_at"].max().isoformat(),
    )
    print(
        "Target mean/std:",
        round(dataset.actual_technical_minutes.mean(), 2),
        "/",
        round(dataset.actual_technical_minutes.std(), 2),
    )


if __name__ == "__main__":
    main()
