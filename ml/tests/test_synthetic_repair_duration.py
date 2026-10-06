from __future__ import annotations

import heapq
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ML_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_ROOT))
sys.path.insert(0, str(ML_ROOT / "src"))

from generate_synthetic_repair_duration import CATALOG, N_SAMPLES, generate_dataset  # noqa: E402
from repair_duration_ml.config import (  # noqa: E402
    FEATURE_COLUMNS,
    FORBIDDEN_COLUMNS,
    MODEL_NAMES,
    OUTPUT_COLUMNS,
    SEED,
    TARGET,
)
from repair_duration_ml.data import standard_duration_baseline, temporal_holdout_split  # noqa: E402
from repair_duration_ml.evaluation import regression_metrics  # noqa: E402
from repair_duration_ml.models import build_model_specs  # noqa: E402
from repair_duration_ml.training import run_competition, select_winner  # noqa: E402


@pytest.fixture(scope="module")
def full_dataset() -> pd.DataFrame:
    return generate_dataset()


def test_generator_is_reproducible() -> None:
    first = generate_dataset(300, SEED)
    second = generate_dataset(300, SEED)
    pd.testing.assert_frame_equal(first, second)


def test_dataset_has_exact_schema() -> None:
    frame = generate_dataset(120, SEED)
    assert list(frame.columns) == OUTPUT_COLUMNS
    assert len(FEATURE_COLUMNS) == 14
    assert frame.sample_id.is_unique
    assert not frame.duplicated().any()


def test_historical_features_are_strictly_as_of() -> None:
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
        assert row.technician_issue_experience_before == issue_counts[(technician, row.service_issue)]
        if durations[technician]:
            assert row.technician_average_duration_before == pytest.approx(np.mean(durations[technician]))
            assert row.technician_historical_efficiency_before == pytest.approx(np.mean(efficiencies[technician]))
        else:
            assert pd.isna(row.technician_average_duration_before)
            assert pd.isna(row.technician_historical_efficiency_before)
        heapq.heappush(pending, (pd.Timestamp(row.completed_at), sequence, row))


def test_feature_contract_has_no_future_target_leakage() -> None:
    assert TARGET not in FEATURE_COLUMNS
    assert "completed_at" not in FEATURE_COLUMNS
    assert not ({"feedback", "eta_error", "predicted_duration"} & set(FEATURE_COLUMNS))


def test_hidden_synthetic_factors_are_not_exported(full_dataset: pd.DataFrame) -> None:
    assert not (set(full_dataset.columns) & FORBIDDEN_COLUMNS)
    assert not any("latent" in column or "hidden" in column for column in full_dataset.columns)


def test_rows_are_chronological_and_completion_is_later(full_dataset: pd.DataFrame) -> None:
    assert full_dataset.prediction_timestamp.is_monotonic_increasing
    assert (full_dataset.completed_at > full_dataset.prediction_timestamp).all()


def test_only_cold_start_history_is_missing(full_dataset: pd.DataFrame) -> None:
    missing_columns = set(full_dataset.columns[full_dataset.isna().any()])
    assert missing_columns == {
        "technician_average_duration_before",
        "technician_historical_efficiency_before",
    }
    cold = full_dataset[full_dataset.technician_jobs_completed_before == 0]
    assert cold.technician_average_duration_before.isna().all()
    assert cold.technician_historical_efficiency_before.isna().all()


def test_all_four_model_builders_instantiate() -> None:
    specs = build_model_specs(smoke=True)
    assert tuple(specs) == MODEL_NAMES
    assert all(spec.estimator is not None and spec.parameters for spec in specs.values())


def test_training_pipeline_smoke_run_and_cold_start(tmp_path: Path) -> None:
    smoke_data = generate_dataset(260, SEED)
    data_path = tmp_path / "smoke.csv"
    output_path = tmp_path / "artifacts"
    smoke_data.to_csv(data_path, index=False, date_format="%Y-%m-%dT%H:%M:%S")
    result = run_competition(
        data_path,
        output_dir=output_path,
        cv_splits=2,
        search_iterations=1,
        smoke=True,
    )
    assert set(MODEL_NAMES).issubset(set(result.cv_table.model))
    assert result.winner_name in MODEL_NAMES
    assert set(result.cold_start_predictions) == {
        "known_history",
        "new_technician",
        "unseen_categories",
    }
    assert np.isfinite(list(result.cold_start_predictions.values())).all()
    assert (output_path / "metadata.json").exists()
    assert (output_path / "metrics.json").exists()
    assert (output_path / "feature_contract.json").exists()


def test_holdout_is_strictly_later_than_development(full_dataset: pd.DataFrame) -> None:
    split = temporal_holdout_split(full_dataset)
    assert split.development.prediction_timestamp.max() <= split.test.prediction_timestamp.min()
    assert len(split.development) == 4250
    assert len(split.test) == 750


def test_winner_selection_uses_only_development_cv() -> None:
    cv = pd.DataFrame(
        [
            {"model": name, "cv_mae_mean": mae, "cv_mae_std": 1.0, "cv_rmse": 2.0, "cv_p90_absolute_error": 3.0}
            for name, mae in zip(MODEL_NAMES, [10.0, 11.0, 12.0, 13.0])
        ]
    )
    winner, reason = select_winner(cv)
    assert winner == "RandomForestRegressor"
    assert "test set was not consulted" in reason
    hypothetical_test = {"CatBoostRegressor": 0.01}
    assert hypothetical_test and select_winner(cv)[0] == winner


def test_standard_duration_business_baseline_is_identity() -> None:
    frame = generate_dataset(50, SEED)
    predicted = standard_duration_baseline(frame)
    np.testing.assert_array_equal(predicted, frame.standard_duration_minutes.to_numpy(dtype=float))


def test_p90_absolute_error_metric() -> None:
    actual = np.zeros(10)
    predicted = np.arange(10, dtype=float)
    metrics = regression_metrics(actual, predicted)
    assert metrics["mae"] == pytest.approx(4.5)
    assert metrics["p90_absolute_error"] == pytest.approx(np.percentile(np.arange(10), 90))


def test_full_v2_dataset_and_catalog_domain(full_dataset: pd.DataFrame) -> None:
    assert len(full_dataset) == N_SAMPLES
    assert set(full_dataset.device_type) == {"iPhone", "iPad", "MacBook", "Apple Watch", "AirPods"}
    assert full_dataset.actual_technical_minutes.between(10, 600).all()
    valid_relationships = {
        (entry.device_type, entry.device_model, entry.issue, entry.service_type, entry.service_name)
        for entry in CATALOG
    }
    observed = set(
        full_dataset[
            ["device_type", "device_model", "service_issue", "service_type", "catalog_service"]
        ].itertuples(index=False, name=None)
    )
    assert observed.issubset(valid_relationships)


def test_committed_v2_csv_matches_generator(full_dataset: pd.DataFrame) -> None:
    committed = pd.read_csv(
        ML_ROOT / "data" / "synthetic_repair_duration_v2.csv",
        parse_dates=["prediction_timestamp", "completed_at"],
    )
    pd.testing.assert_frame_equal(
        committed,
        full_dataset,
        check_exact=False,
        rtol=1e-12,
        atol=1e-12,
    )
