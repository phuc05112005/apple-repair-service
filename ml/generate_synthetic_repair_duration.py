"""Generate the controlled, leakage-safe final repair-duration dataset.

Warranty is a business context (is_warranty), never a third technical action.
Historical features are released through a completion-time priority queue, so
an earlier-started job that has not completed cannot influence the current row.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

ML_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_ROOT / "src"))

from repair_duration_ml.config import SEED  # noqa: E402
from repair_duration_ml.data import validate_dataset  # noqa: E402
from repair_duration_ml.features import attach_historical_features  # noqa: E402

FINAL_SEED = SEED
N_SAMPLES = 5_000
DATASET_VERSION = "synthetic-repair-duration-final-v1"
DEFAULT_OUTPUT = ML_ROOT / "data" / "synthetic_repair_duration.csv"


@dataclass(frozen=True)
class CatalogEntry:
    device_type: str
    device_model: str
    issue: str
    technical_action: str
    service_name: str
    standard_minutes: int
    sampling_weight: float
    hidden_complexity: float


# Versioned synthetic master data. It is plausible, not asserted to be a live
# database snapshot. Warranty is deliberately absent from technical_action and
# from service names.
CATALOG = [
    CatalogEntry("iPhone", "iPhone 13", "Pin", "REPLACEMENT", "Thay pin iPhone 13", 60, 1.20, 1.00),
    CatalogEntry("iPhone", "iPhone 13", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 13", 105, .90, 1.04),
    CatalogEntry("iPhone", "iPhone 13", "Cổng sạc", "REPAIR", "Sửa cổng sạc iPhone 13", 80, .72, 1.08),
    CatalogEntry("iPhone", "iPhone 14", "Pin", "REPLACEMENT", "Thay pin iPhone 14", 65, 1.15, 1.00),
    CatalogEntry("iPhone", "iPhone 14", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 14", 110, .88, 1.04),
    CatalogEntry("iPhone", "iPhone 14", "Camera", "REPLACEMENT", "Thay camera iPhone 14", 75, .58, 1.06),
    CatalogEntry("iPhone", "iPhone 15 Pro", "Pin", "REPLACEMENT", "Thay pin iPhone 15 Pro", 70, 1.00, 1.02),
    CatalogEntry("iPhone", "iPhone 15 Pro", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 15 Pro", 120, .78, 1.08),
    CatalogEntry("iPhone", "iPhone 15 Pro", "Mainboard", "REPAIR", "Sửa mainboard iPhone 15 Pro", 210, .42, 1.16),
    CatalogEntry("iPhone", "iPhone 16 Pro", "Pin", "REPLACEMENT", "Thay pin iPhone 16 Pro", 75, .92, 1.03),
    CatalogEntry("iPhone", "iPhone 16 Pro", "Màn hình", "REPLACEMENT", "Thay màn hình iPhone 16 Pro", 125, .74, 1.09),
    CatalogEntry("iPhone", "iPhone 16 Pro", "Mainboard", "REPAIR", "Sửa mainboard iPhone 16 Pro", 220, .30, 1.17),
    CatalogEntry("iPad", "iPad 10", "Pin", "REPLACEMENT", "Thay pin iPad 10", 120, .66, 1.06),
    CatalogEntry("iPad", "iPad 10", "Màn hình", "REPLACEMENT", "Thay màn hình iPad 10", 150, .56, 1.10),
    CatalogEntry("iPad", "iPad 10", "Cổng sạc", "REPAIR", "Sửa cổng sạc iPad 10", 100, .46, 1.08),
    CatalogEntry("iPad", "iPad Air M2", "Pin", "REPLACEMENT", "Thay pin iPad Air M2", 130, .50, 1.08),
    CatalogEntry("iPad", "iPad Air M2", "Màn hình", "REPLACEMENT", "Thay màn hình iPad Air M2", 145, .38, 1.12),
    CatalogEntry("iPad", "iPad Pro M4", "Cổng sạc", "REPAIR", "Sửa cổng sạc iPad Pro M4", 115, .30, 1.12),
    CatalogEntry("MacBook", "MacBook Air M1", "Pin", "REPLACEMENT", "Thay pin MacBook Air M1", 130, .68, 1.06),
    CatalogEntry("MacBook", "MacBook Air M1", "Bàn phím", "REPLACEMENT", "Thay bàn phím MacBook Air M1", 190, .40, 1.12),
    CatalogEntry("MacBook", "MacBook Air M1", "Mainboard", "REPAIR", "Sửa mainboard MacBook Air M1", 240, .36, 1.18),
    CatalogEntry("MacBook", "MacBook Air M2", "Pin", "REPLACEMENT", "Thay pin MacBook Air M2", 140, .58, 1.08),
    CatalogEntry("MacBook", "MacBook Air M2", "Màn hình", "REPLACEMENT", "Thay màn hình MacBook Air M2", 210, .36, 1.12),
    CatalogEntry("MacBook", "MacBook Pro 14", "Bàn phím", "REPAIR", "Sửa bàn phím MacBook Pro 14", 170, .32, 1.13),
    CatalogEntry("MacBook", "MacBook Pro 14", "Mainboard", "REPAIR", "Sửa mainboard MacBook Pro 14", 260, .32, 1.19),
    CatalogEntry("Apple Watch", "Apple Watch Series 8", "Pin", "REPLACEMENT", "Thay pin Apple Watch Series 8", 85, .48, 1.06),
    CatalogEntry("Apple Watch", "Apple Watch Series 8", "Màn hình", "REPLACEMENT", "Thay màn hình Apple Watch Series 8", 125, .34, 1.11),
    CatalogEntry("Apple Watch", "Apple Watch Series 9", "Digital Crown", "REPAIR", "Sửa Digital Crown Apple Watch Series 9", 95, .30, 1.10),
    CatalogEntry("Apple Watch", "Apple Watch Series 9", "Sạc không dây", "REPAIR", "Sửa sạc Apple Watch Series 9", 105, .28, 1.12),
    CatalogEntry("Apple Watch", "Apple Watch Ultra 2", "Màn hình", "REPLACEMENT", "Thay màn hình Apple Watch Ultra 2", 150, .27, 1.15),
    CatalogEntry("AirPods", "AirPods 3", "Pin tai nghe", "REPLACEMENT", "Thay pin tai nghe AirPods 3", 70, .42, 1.04),
    CatalogEntry("AirPods", "AirPods 3", "Hộp sạc", "REPAIR", "Sửa hộp sạc AirPods 3", 80, .38, 1.07),
    CatalogEntry("AirPods", "AirPods Pro 2", "Âm thanh", "REPAIR", "Sửa âm thanh AirPods Pro 2", 90, .38, 1.10),
    CatalogEntry("AirPods", "AirPods Pro 2", "Chống ồn", "REPAIR", "Sửa chống ồn AirPods Pro 2", 105, .30, 1.12),
    CatalogEntry("AirPods", "AirPods Pro 2", "Hộp sạc", "REPLACEMENT", "Thay hộp sạc AirPods Pro 2", 75, .28, 1.08),
    CatalogEntry("AirPods", "AirPods Max", "Pin", "REPLACEMENT", "Thay pin AirPods Max", 100, .25, 1.09),
    CatalogEntry("AirPods", "AirPods Max", "Âm thanh", "REPAIR", "Sửa âm thanh AirPods Max", 120, .25, 1.13),
]

TECHNICIANS = [f"TECH_{number:02d}" for number in range(1, 13)]
BRANCHES = ["BRANCH_01", "BRANCH_02", "BRANCH_03"]
ISSUES = sorted({entry.issue for entry in CATALOG})
SERVICES = [entry.service_name for entry in CATALOG]


def _prediction_timestamps(rng: np.random.Generator, n_samples: int) -> pd.DatetimeIndex:
    business_days = pd.bdate_range("2025-01-02", "2026-09-30")
    day_indexes = rng.integers(0, len(business_days), size=n_samples)
    minute_offsets = rng.integers(8 * 60, 18 * 60, size=n_samples)
    return pd.DatetimeIndex(
        business_days[day_indexes] + pd.to_timedelta(minute_offsets, unit="m")
    ).sort_values()


def _latent_configuration(rng: np.random.Generator):
    capability = {
        technician: float(speed)
        for technician, speed in zip(
            TECHNICIANS, rng.uniform(0.82, 1.20, len(TECHNICIANS))
        )
    }
    issue_specialties = {
        technician: set(rng.choice(ISSUES, size=3, replace=False).tolist())
        for technician in TECHNICIANS
    }
    catalog_specialties = {
        technician: set(rng.choice(SERVICES, size=5, replace=False).tolist())
        for technician in TECHNICIANS
    }
    home_branch = {
        technician: BRANCHES[index % len(BRANCHES)]
        for index, technician in enumerate(TECHNICIANS)
    }
    return capability, issue_specialties, catalog_specialties, home_branch


def _raw_jobs(rng: np.random.Generator, n_samples: int) -> list[dict]:
    timestamps = _prediction_timestamps(rng, n_samples)
    weights = np.asarray([entry.sampling_weight for entry in CATALOG], dtype=float)
    weights /= weights.sum()
    capability, issue_specialties, catalog_specialties, home_branch = (
        _latent_configuration(rng)
    )
    technician_start = {
        technician: pd.Timestamp("2025-01-01") + pd.Timedelta(days=35 * index)
        for index, technician in enumerate(TECHNICIANS)
    }
    branch_factors = {"BRANCH_01": .98, "BRANCH_02": 1.03, "BRANCH_03": 1.07}
    action_factors = {"REPAIR": 1.05, "REPLACEMENT": .98}
    rows: list[dict] = []

    for index, prediction_at in enumerate(timestamps):
        entry = CATALOG[int(rng.choice(len(CATALOG), p=weights))]
        branch = str(rng.choice(BRANCHES, p=[.45, .35, .20]))
        active = [
            technician
            for technician in TECHNICIANS
            if technician_start[technician] <= prediction_at
        ]
        technician_weights = np.asarray(
            [
                (1.65 if home_branch[t] == branch else .55)
                * (1.30 if entry.issue in issue_specialties[t] else 1.0)
                for t in active
            ],
            dtype=float,
        )
        technician_weights /= technician_weights.sum()
        technician = str(rng.choice(active, p=technician_weights))

        issue_factor = .90 if entry.issue in issue_specialties[technician] else 1.045
        catalog_factor = (
            .92 if entry.service_name in catalog_specialties[technician] else 1.025
        )
        seasonal_factor = 1.0 + .035 * np.sin(
            (prediction_at.month - 1) / 12 * 2 * np.pi
        )
        ordinary_noise = float(rng.lognormal(mean=-.5 * .22**2, sigma=.22))
        case_complexity = float(rng.uniform(1.20, 1.58)) if rng.random() < .09 else 1.0
        outlier_draw = rng.random()
        outlier_factor = float(rng.uniform(1.55, 2.30)) if outlier_draw < .020 else 1.0
        if outlier_draw > .995:
            outlier_factor = float(rng.uniform(.62, .80))

        # Warranty is operational context and is absent from this duration equation.
        is_warranty = int(rng.random() < .11)
        hidden_duration = (
            entry.standard_minutes
            * capability[technician]
            * issue_factor
            * catalog_factor
            * entry.hidden_complexity
            * branch_factors[branch]
            * action_factors[entry.technical_action]
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
                "sample_id": f"SYN_RD_FINAL_{index + 1:06d}",
                "prediction_timestamp": prediction_at,
                "completed_at": completed_at,
                "device_type": entry.device_type,
                "device_model": entry.device_model,
                "service_issue": entry.issue,
                "technical_action": entry.technical_action,
                "is_warranty": is_warranty,
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


def generate_dataset(n_samples: int = N_SAMPLES, seed: int = FINAL_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    frame = attach_historical_features(_raw_jobs(rng, n_samples))
    validate_dataset(frame, n_samples)
    return frame


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=int, default=N_SAMPLES)
    parser.add_argument("--seed", type=int, default=FINAL_SEED)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    frame = generate_dataset(args.rows, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(args.output, index=False, date_format="%Y-%m-%dT%H:%M:%S")
    print(f"Wrote {len(frame):,} final rows x {len(frame.columns)} columns to {args.output}")


if __name__ == "__main__":
    main()
