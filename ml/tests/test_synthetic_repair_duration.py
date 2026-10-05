from __future__ import annotations

import heapq
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd
import pytest


ML_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_ROOT))

from generate_synthetic_repair_duration import (  # noqa: E402
    FEATURE_COLUMNS,
    OUTPUT_COLUMNS,
    SEED,
    generate_dataset,
)


def test_generator_is_reproducible_and_has_expected_contract() -> None:
    first = generate_dataset(300, SEED)
    second = generate_dataset(300, SEED)
    pd.testing.assert_frame_equal(first, second)
    assert list(first.columns) == OUTPUT_COLUMNS
    assert len(FEATURE_COLUMNS) == 14
    assert first.sample_id.is_unique
    assert not first.duplicated().any()


def test_historical_features_only_use_jobs_completed_before_prediction() -> None:
    frame = generate_dataset(600, SEED)
    pending: list[tuple[pd.Timestamp, int, pd.Series]] = []
    durations: defaultdict[str, list[float]] = defaultdict(list)
    efficiencies: defaultdict[str, list[float]] = defaultdict(list)
    issue_counts: defaultdict[tuple[str, str], int] = defaultdict(int)

    for sequence, row in frame.iterrows():
        prediction_at = pd.Timestamp(row.prediction_timestamp)
        while pending and pending[0][0] < prediction_at:
            _, _, completed = heapq.heappop(pending)
            technician = completed.technician_id
            durations[technician].append(completed.actual_technical_minutes)
            efficiencies[technician].append(
                completed.actual_technical_minutes / completed.standard_duration_minutes
            )
            issue_counts[(technician, completed.service_issue)] += 1

        technician = row.technician_id
        assert row.technician_jobs_completed_before == len(durations[technician])
        assert row.technician_issue_experience_before == issue_counts[
            (technician, row.service_issue)
        ]
        if durations[technician]:
            assert row.technician_average_duration_before == pytest.approx(
                sum(durations[technician]) / len(durations[technician])
            )
            assert row.technician_historical_efficiency_before == pytest.approx(
                sum(efficiencies[technician]) / len(efficiencies[technician])
            )
        else:
            assert pd.isna(row.technician_average_duration_before)
            assert pd.isna(row.technician_historical_efficiency_before)

        heapq.heappush(pending, (pd.Timestamp(row.completed_at), sequence, row))


def test_full_dataset_has_only_intentional_missing_values() -> None:
    frame = generate_dataset()
    assert len(frame) == 5_000
    assert frame.prediction_timestamp.is_monotonic_increasing
    assert (frame.completed_at > frame.prediction_timestamp).all()
    missing_columns = set(frame.columns[frame.isna().any()])
    assert missing_columns == {
        "technician_average_duration_before",
        "technician_historical_efficiency_before",
    }
    assert frame.actual_technical_minutes.between(10, 600).all()


def test_committed_csv_matches_the_versioned_generator() -> None:
    committed = pd.read_csv(
        ML_ROOT / "data" / "synthetic_repair_duration_v1.csv",
        parse_dates=["prediction_timestamp", "completed_at"],
    )
    expected = generate_dataset()
    pd.testing.assert_frame_equal(
        committed,
        expected,
        check_exact=False,
        rtol=1e-12,
        atol=1e-12,
    )
