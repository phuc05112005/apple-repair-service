"""Generate the controlled V2 repair-duration regression dataset.

All rows are synthetic and generated from a versioned, internally consistent
Apple-device service catalog. The repository has no complete canonical master
seed, so these labels must not be presented as records that exist in a live
database. The generator never connects to MySQL.

Historical technician features are calculated strictly as-of prediction time:
only jobs with ``completed_at < current_prediction_timestamp`` contribute.
Hidden speed, specialty, complexity and outlier factors create the target but
are deliberately never exported.
"""

from __future__ import annotations

import argparse
import heapq
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

ML_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_ROOT / "src"))

from repair_duration_ml.config import FEATURE_COLUMNS, OUTPUT_COLUMNS, SEED  # noqa: E402
from repair_duration_ml.data import validate_dataset  # noqa: E402

N_SAMPLES = 5_000
DATASET_VERSION = "synthetic-repair-duration-v2"
DEFAULT_OUTPUT = ML_ROOT / "data" / "synthetic_repair_duration_v2.csv"


@dataclass(frozen=True)
class CatalogEntry:
    device_type: str
    device_model: str
    issue: str
    service_type: str
    service_name: str
    standard_minutes: int
    sampling_weight: float
    hidden_complexity: float


# Controlled synthetic master data. Every relationship is plausible for the
# device/model; for example AirPods never receives a camera issue.
CATALOG = [
    CatalogEntry("iPhone", "iPhone 13", "Pin", "REPLACEMENT", "Thay pin iPhone 13", 60, 1.20, 1.00),
    CatalogEntry("iPhone", "iPhone 13", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 13", 105, 0.90, 1.04),
    CatalogEntry("iPhone", "iPhone 13", "Cổng sạc", "REPAIR", "Sửa cổng sạc iPhone 13", 80, 0.72, 1.08),
    CatalogEntry("iPhone", "iPhone 14", "Pin", "REPLACEMENT", "Thay pin iPhone 14", 65, 1.15, 1.00),
    CatalogEntry("iPhone", "iPhone 14", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 14", 110, 0.88, 1.04),
    CatalogEntry("iPhone", "iPhone 14", "Camera", "REPLACEMENT", "Thay camera iPhone 14", 75, 0.58, 1.06),
    CatalogEntry("iPhone", "iPhone 15 Pro", "Pin", "REPLACEMENT", "Thay pin iPhone 15 Pro", 70, 1.00, 1.02),
    CatalogEntry("iPhone", "iPhone 15 Pro", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 15 Pro", 120, 0.78, 1.08),
    CatalogEntry("iPhone", "iPhone 15 Pro", "Mainboard", "REPAIR", "Sửa mainboard iPhone 15 Pro", 210, 0.42, 1.16),
    CatalogEntry("iPhone", "iPhone 16 Pro", "Pin", "REPLACEMENT", "Thay pin iPhone 16 Pro", 75, 0.92, 1.03),
    CatalogEntry("iPhone", "iPhone 16 Pro", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 16 Pro", 125, 0.74, 1.09),
    CatalogEntry("iPhone", "iPhone 16 Pro", "Pin", "WARRANTY", "Xử lý bảo hành pin iPhone 16 Pro", 70, 0.36, 1.06),
    CatalogEntry("iPad", "iPad 10", "Pin", "REPLACEMENT", "Thay pin iPad 10", 120, 0.66, 1.06),
    CatalogEntry("iPad", "iPad 10", "Màn hình", "REPLACEMENT", "Thay màn hình iPad 10", 150, 0.56, 1.10),
    CatalogEntry("iPad", "iPad 10", "Cổng sạc", "REPAIR", "Sửa cổng sạc iPad 10", 100, 0.46, 1.08),
    CatalogEntry("iPad", "iPad Air M2", "Pin", "REPLACEMENT", "Thay pin iPad Air M2", 130, 0.50, 1.08),
    CatalogEntry("iPad", "iPad Air M2", "Màn hình", "WARRANTY", "Bảo hành màn hình iPad Air M2", 145, 0.30, 1.12),
    CatalogEntry("iPad", "iPad Pro M4", "Cổng sạc", "REPAIR", "Sửa cổng sạc iPad Pro M4", 115, 0.30, 1.12),
    CatalogEntry("MacBook", "MacBook Air M1", "Pin", "REPLACEMENT", "Thay pin MacBook Air M1", 130, 0.68, 1.06),
    CatalogEntry("MacBook", "MacBook Air M1", "Bàn phím", "REPLACEMENT", "Thay bàn phím MacBook Air M1", 190, 0.40, 1.12),
    CatalogEntry("MacBook", "MacBook Air M1", "Mainboard", "REPAIR", "Sửa mainboard MacBook Air M1", 240, 0.36, 1.18),
    CatalogEntry("MacBook", "MacBook Air M2", "Pin", "REPLACEMENT", "Thay pin MacBook Air M2", 140, 0.58, 1.08),
    CatalogEntry("MacBook", "MacBook Air M2", "Màn hình", "REPLACEMENT", "Thay màn hình MacBook Air M2", 210, 0.36, 1.12),
    CatalogEntry("MacBook", "MacBook Pro 14", "Bàn phím", "REPAIR", "Sửa bàn phím MacBook Pro 14", 170, 0.32, 1.13),
    CatalogEntry("MacBook", "MacBook Pro 14", "Mainboard", "WARRANTY", "Bảo hành mainboard MacBook Pro 14", 260, 0.26, 1.19),
    CatalogEntry("Apple Watch", "Apple Watch Series 8", "Pin", "REPLACEMENT", "Thay pin Apple Watch Series 8", 85, 0.48, 1.06),
    CatalogEntry("Apple Watch", "Apple Watch Series 8", "Màn hình", "REPLACEMENT", "Thay màn hình Apple Watch Series 8", 125, 0.34, 1.11),
    CatalogEntry("Apple Watch", "Apple Watch Series 9", "Digital Crown", "REPAIR", "Sửa Digital Crown Apple Watch Series 9", 95, 0.30, 1.10),
    CatalogEntry("Apple Watch", "Apple Watch Series 9", "Sạc không dây", "REPAIR", "Sửa sạc Apple Watch Series 9", 105, 0.28, 1.12),
    CatalogEntry("Apple Watch", "Apple Watch Ultra 2", "Màn hình", "WARRANTY", "Bảo hành màn hình Apple Watch Ultra 2", 150, 0.22, 1.15),
    CatalogEntry("AirPods", "AirPods 3", "Pin tai nghe", "REPLACEMENT", "Thay pin tai nghe AirPods 3", 70, 0.42, 1.04),
    CatalogEntry("AirPods", "AirPods 3", "Hộp sạc", "REPAIR", "Sửa hộp sạc AirPods 3", 80, 0.38, 1.07),
    CatalogEntry("AirPods", "AirPods Pro 2", "Âm thanh", "REPAIR", "Sửa lỗi âm thanh AirPods Pro 2", 90, 0.38, 1.10),
    CatalogEntry("AirPods", "AirPods Pro 2", "Chống ồn", "REPAIR", "Sửa chống ồn AirPods Pro 2", 105, 0.30, 1.12),
    CatalogEntry("AirPods", "AirPods Pro 2", "Hộp sạc", "WARRANTY", "Bảo hành hộp sạc AirPods Pro 2", 75, 0.24, 1.08),
    CatalogEntry("AirPods", "AirPods Max", "Pin", "REPLACEMENT", "Thay pin AirPods Max", 100, 0.25, 1.09),
    CatalogEntry("AirPods", "AirPods Max", "Âm thanh", "WARRANTY", "Bảo hành âm thanh AirPods Max", 120, 0.20, 1.13),
]

TECHNICIANS = [f"TECH_{number:02d}" for number in range(1, 13)]
BRANCHES = ["BRANCH_01", "BRANCH_02", "BRANCH_03"]
ISSUES = sorted({entry.issue for entry in CATALOG})


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


def _latent_configuration(
    rng: np.random.Generator,
) -> tuple[dict[str, float], dict[str, set[str]], dict[str, str]]:
    technician_capability = {
        technician: float(speed)
        for technician, speed in zip(
            TECHNICIANS, rng.uniform(0.82, 1.20, len(TECHNICIANS))
        )
    }
    technician_specialties = {
        technician: set(rng.choice(ISSUES, size=3, replace=False).tolist())
        for technician in TECHNICIANS
    }
    technician_branch = {
        technician: BRANCHES[index % len(BRANCHES)]
        for index, technician in enumerate(TECHNICIANS)
    }
    return technician_capability, technician_specialties, technician_branch


def _raw_jobs(rng: np.random.Generator, n_samples: int) -> list[dict]:
    timestamps = _prediction_timestamps(rng, n_samples)
    weights = np.asarray([entry.sampling_weight for entry in CATALOG], dtype=float)
    weights /= weights.sum()
    capability, specialties, home_branch = _latent_configuration(rng)
    technician_start = {
        technician: pd.Timestamp("2025-01-01") + pd.Timedelta(days=35 * index)
        for index, technician in enumerate(TECHNICIANS)
    }
    branch_factors = {"BRANCH_01": 0.98, "BRANCH_02": 1.03, "BRANCH_03": 1.07}
    service_factors = {"REPAIR": 1.05, "REPLACEMENT": 0.98, "WARRANTY": 1.08}
    rows: list[dict] = []

    for index, prediction_at in enumerate(timestamps):
        entry = CATALOG[int(rng.choice(len(CATALOG), p=weights))]
        branch = str(rng.choice(BRANCHES, p=[0.45, 0.35, 0.20]))
        active_technicians = [
            technician
            for technician in TECHNICIANS
            if technician_start[technician] <= prediction_at
        ]
        technician_weights = np.asarray(
            [
                (1.65 if home_branch[technician] == branch else 0.55)
                * (1.35 if entry.issue in specialties[technician] else 1.0)
                for technician in active_technicians
            ],
            dtype=float,
        )
        technician_weights /= technician_weights.sum()
        technician = str(rng.choice(active_technicians, p=technician_weights))

        specialty_factor = 0.89 if entry.issue in specialties[technician] else 1.045
        seasonal_factor = 1.0 + 0.035 * np.sin(
            (prediction_at.month - 1) / 12 * 2 * np.pi
        )
        ordinary_noise = float(rng.lognormal(mean=-0.5 * 0.22**2, sigma=0.22))
        case_complexity = float(rng.uniform(1.20, 1.58)) if rng.random() < 0.09 else 1.0
        outlier_draw = rng.random()
        outlier_factor = float(rng.uniform(1.55, 2.30)) if outlier_draw < 0.020 else 1.0
        if outlier_draw > 0.995:
            outlier_factor = float(rng.uniform(0.62, 0.80))

        hidden_duration = (
            entry.standard_minutes
            * capability[technician]
            * specialty_factor
            * entry.hidden_complexity
            * branch_factors[branch]
            * service_factors[entry.service_type]
            * seasonal_factor
            * ordinary_noise
            * case_complexity
            * outlier_factor
        )
        actual_duration = int(np.clip(np.rint(hidden_duration), 10, 600))
        non_technical_elapsed = int(rng.gamma(shape=1.7, scale=24.0))
        completed_at = prediction_at + pd.Timedelta(
            minutes=actual_duration + non_technical_elapsed
        )
        rows.append(
            {
                "sample_id": f"SYN_RD_V2_{index + 1:06d}",
                "prediction_timestamp": prediction_at,
                "completed_at": completed_at,
                "device_type": entry.device_type,
                "device_model": entry.device_model,
                "service_issue": entry.issue,
                "service_type": entry.service_type,
                "catalog_service": entry.service_name,
                "standard_duration_minutes": entry.standard_minutes,
                "technician_id": technician,
                "branch_id": branch,
                "prediction_month": f"M{prediction_at.month:02d}",
                "prediction_weekday": prediction_at.day_name()[:3].upper(),
                "actual_technical_minutes": actual_duration,
            }
        )
    return rows


def attach_historical_features(rows: list[dict]) -> pd.DataFrame:
    """Attach history from jobs completed strictly before each prediction."""
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
                completed["actual_technical_minutes"],
                completed["standard_duration_minutes"],
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
    print(f"Dataset version: {DATASET_VERSION}")
    print(f"Wrote {len(dataset)} rows to {args.output}")
    print(
        "Range:",
        dataset["prediction_timestamp"].min().isoformat(),
        "->",
        dataset["completed_at"].max().isoformat(),
    )
    print("Devices:", dataset["device_type"].value_counts().to_dict())
    print(
        "Target mean/std:",
        round(dataset.actual_technical_minutes.mean(), 2),
        "/",
        round(dataset.actual_technical_minutes.std(), 2),
    )


if __name__ == "__main__":
    main()
