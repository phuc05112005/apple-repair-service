"""Leakage-safe history features and development-only ablation groups."""

from __future__ import annotations

import heapq
from collections import defaultdict
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .config import OUTPUT_COLUMNS, TARGET

BASE_JOB_FEATURES = [
    "device_type", "device_model", "service_issue", "technical_action",
    "is_warranty", "catalog_service", "standard_duration_minutes",
    "branch_id", "prediction_month", "prediction_weekday",
]
TECHNICIAN_OVERALL_FEATURES = [
    "technician_id", "technician_jobs_completed_before",
    "technician_average_duration_before", "technician_historical_efficiency_before",
]
TECHNICIAN_ISSUE_FEATURES = [
    "technician_issue_jobs_before", "technician_issue_average_duration_before",
    "technician_issue_efficiency_before",
]
TECHNICIAN_CATALOG_FEATURES = [
    "technician_catalog_jobs_before", "technician_catalog_average_duration_before",
    "technician_catalog_efficiency_before",
]
FEATURE_ABLATION_STAGES = {
    "BASE_JOB": BASE_JOB_FEATURES,
    "PLUS_TECHNICIAN_OVERALL_HISTORY": BASE_JOB_FEATURES + TECHNICIAN_OVERALL_FEATURES,
    "PLUS_TECHNICIAN_ISSUE": BASE_JOB_FEATURES + TECHNICIAN_OVERALL_FEATURES + TECHNICIAN_ISSUE_FEATURES,
    "PLUS_TECHNICIAN_CATALOG": BASE_JOB_FEATURES + TECHNICIAN_OVERALL_FEATURES + TECHNICIAN_ISSUE_FEATURES + TECHNICIAN_CATALOG_FEATURES,
}
FEATURE_EVIDENCE = {
    "base_job": {
        "business_meaning": "Known device, issue, approved action, catalog standard, branch and calendar context.",
        "availability": "Available when the first assignment begins after the single-item plan is known.",
        "leakage_safety": "No completion, feedback, future status or generated latent factor.",
    },
    "technician_overall": {
        "business_meaning": "Technician identity plus completed-job history.",
        "availability": "Computed only from jobs completed before prediction.",
        "leakage_safety": "Strict completed_at < prediction_timestamp; unfinished concurrent jobs are excluded.",
    },
    "technician_issue": {
        "business_meaning": "Prior experience of the technician on the same issue.",
        "availability": "Derived from earlier completed matching jobs.",
        "leakage_safety": "Strict as-of boundary; zero count and missing statistics mean cold start.",
    },
    "technician_catalog": {
        "business_meaning": "Prior experience on the exact catalog service.",
        "availability": "Derived from earlier completed matching jobs.",
        "leakage_safety": "Strict as-of boundary; no full-data aggregation or target fill.",
    },
}


@dataclass
class RunningHistory:
    jobs: int = 0
    duration_sum: float = 0.0
    efficiency_sum: float = 0.0

    def update(self, duration: float, standard: float) -> None:
        self.jobs += 1
        self.duration_sum += duration
        self.efficiency_sum += duration / standard

    @property
    def average_duration(self) -> float:
        return self.duration_sum / self.jobs if self.jobs else np.nan

    @property
    def average_efficiency(self) -> float:
        return self.efficiency_sum / self.jobs if self.jobs else np.nan


def catalog_history_key(row: dict) -> tuple[str, object]:
    """Keep DB identity separate from the model's display-name category."""
    identity = row.get("internal_catalog_id")
    return ("id", identity) if identity is not None else ("label", row["catalog_service"])


@dataclass
class HistoryIndex:
    overall: defaultdict[str, RunningHistory] = field(default_factory=lambda: defaultdict(RunningHistory))
    by_issue: defaultdict[tuple[str, str], RunningHistory] = field(default_factory=lambda: defaultdict(RunningHistory))
    by_catalog: defaultdict[tuple[str, tuple[str, object]], RunningHistory] = field(default_factory=lambda: defaultdict(RunningHistory))

    def add(self, row: dict) -> None:
        technician = row["technician_id"]
        duration = row[TARGET]
        standard = row["standard_duration_minutes"]
        self.overall[technician].update(duration, standard)
        self.by_issue[(technician, row["service_issue"])].update(duration, standard)
        self.by_catalog[(technician, catalog_history_key(row))].update(duration, standard)

    def values(self, technician: str, issue: str, catalog_key: tuple[str, object]) -> dict:
        histories = (
            self.overall[technician],
            self.by_issue[(technician, issue)],
            self.by_catalog[(technician, catalog_key)],
        )
        return {
            "technician_jobs_completed_before": histories[0].jobs,
            "technician_average_duration_before": histories[0].average_duration,
            "technician_historical_efficiency_before": histories[0].average_efficiency,
            "technician_issue_jobs_before": histories[1].jobs,
            "technician_issue_average_duration_before": histories[1].average_duration,
            "technician_issue_efficiency_before": histories[1].average_efficiency,
            "technician_catalog_jobs_before": histories[2].jobs,
            "technician_catalog_average_duration_before": histories[2].average_duration,
            "technician_catalog_efficiency_before": histories[2].average_efficiency,
        }


def build_history_index(rows: list[dict], evaluation_timestamp: object) -> HistoryIndex:
    """Build one strict-as-of snapshot reusable across candidate technicians."""
    boundary = pd.Timestamp(evaluation_timestamp)
    index = HistoryIndex()
    for row in rows:
        if pd.Timestamp(row["completed_at"]) < boundary:
            index.add(row)
    return index


def attach_historical_features(rows: list[dict]) -> pd.DataFrame:
    """Release history only after a prior job has actually completed."""
    index = HistoryIndex()
    pending: list[tuple[pd.Timestamp, int, dict]] = []
    enriched: list[dict] = []
    for sequence, row in enumerate(rows):
        prediction_at = pd.Timestamp(row["prediction_timestamp"])
        while pending and pending[0][0] < prediction_at:
            _, _, completed = heapq.heappop(pending)
            index.add(completed)
        technician = row["technician_id"]
        current = dict(row)
        current.update(index.values(technician, row["service_issue"], catalog_history_key(row)))
        enriched.append(current)
        heapq.heappush(pending, (pd.Timestamp(row["completed_at"]), sequence, row))
    frame = pd.DataFrame(enriched, columns=OUTPUT_COLUMNS)
    frame["prediction_timestamp"] = pd.to_datetime(frame["prediction_timestamp"])
    frame["completed_at"] = pd.to_datetime(frame["completed_at"])
    return frame
