from __future__ import annotations

import heapq
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ML_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_ROOT))
sys.path.insert(0, str(ML_ROOT / "src"))

from generate_synthetic_repair_duration_v3 import (  # noqa: E402
    CATALOG,
    N_SAMPLES,
    SEED_V3,
    attach_historical_features,
    generate_dataset,
)
from repair_duration_ml_v3.config import (  # noqa: E402
    FEATURE_COLUMNS,
    FORBIDDEN_COLUMNS,
    INTENTIONAL_MISSING_COLUMNS,
    MODEL_NAMES,
    OUTPUT_COLUMNS,
    TARGET,
)
from repair_duration_ml_v3.data import (  # noqa: E402
    standard_duration_baseline,
    temporal_holdout_split,
)
from repair_duration_ml_v3.evaluation import (  # noqa: E402
    cold_start_examples,
    regression_metrics,
)
from repair_duration_ml_v3.models import build_model_specs  # noqa: E402
from repair_duration_ml_v3.training import run_competition, select_winner  # noqa: E402


@pytest.fixture(scope="module")
def full_dataset() -> pd.DataFrame:
    return generate_dataset()


@pytest.fixture(scope="module")
def smoke_result(tmp_path_factory):
    root = tmp_path_factory.mktemp("v3-smoke")
    data = generate_dataset(280, SEED_V3)
    data_path = root / "smoke.csv"
    artifact = root / "artifact"
    data.to_csv(data_path, index=False, date_format="%Y-%m-%dT%H:%M:%S")
    result = run_competition(
        data_path,
        output_dir=artifact,
        cv_splits=2,
        search_iterations=1,
        smoke=True,
    )
    return result, artifact


def _independent_histories(frame: pd.DataFrame):
    pending = []
    overall = defaultdict(list)
    issue = defaultdict(list)
    catalog = defaultdict(list)
    checks = []
    for sequence, row in frame.iterrows():
        prediction = pd.Timestamp(row.prediction_timestamp)
        while pending and pending[0][0] < prediction:
            _, _, old = heapq.heappop(pending)
            pair = (
                float(old.actual_technical_minutes),
                float(old.actual_technical_minutes / old.standard_duration_minutes),
            )
            overall[old.technician_id].append(pair)
            issue[(old.technician_id, old.service_issue)].append(pair)
            catalog[(old.technician_id, old.catalog_service)].append(pair)
        checks.append(
            (
                row,
                list(overall[row.technician_id]),
                list(issue[(row.technician_id, row.service_issue)]),
                list(catalog[(row.technician_id, row.catalog_service)]),
            )
        )
        heapq.heappush(pending, (pd.Timestamp(row.completed_at), sequence, row))
    return checks


def test_v3_generator_is_reproducible() -> None:
    pd.testing.assert_frame_equal(
        generate_dataset(350, SEED_V3), generate_dataset(350, SEED_V3)
    )


def test_v3_exact_schema() -> None:
    frame = generate_dataset(100, SEED_V3)
    assert list(frame.columns) == OUTPUT_COLUMNS
    assert len(FEATURE_COLUMNS) == 20
    assert len(OUTPUT_COLUMNS) == 24


def test_all_five_device_groups_are_present(full_dataset: pd.DataFrame) -> None:
    assert set(full_dataset.device_type) == {
        "iPhone", "iPad", "MacBook", "Apple Watch", "AirPods"
    }


def test_technical_action_domain(full_dataset: pd.DataFrame) -> None:
    assert set(full_dataset.technical_action) == {"REPAIR", "REPLACEMENT"}


def test_warranty_is_binary_context_and_both_values_exist(full_dataset: pd.DataFrame) -> None:
    assert set(full_dataset.is_warranty) == {0, 1}


def test_warranty_is_not_a_technical_action_or_catalog_action(full_dataset: pd.DataFrame) -> None:
    assert "WARRANTY" not in set(full_dataset.technical_action)
    assert not full_dataset.catalog_service.str.contains("bảo hành", case=False).any()


def test_catalog_relationships_are_controlled(full_dataset: pd.DataFrame) -> None:
    valid = {
        (x.device_type, x.device_model, x.issue, x.technical_action, x.service_name)
        for x in CATALOG
    }
    observed = set(
        full_dataset[
            ["device_type", "device_model", "service_issue", "technical_action", "catalog_service"]
        ].itertuples(index=False, name=None)
    )
    assert observed.issubset(valid)


def test_hidden_latent_factors_are_not_exported(full_dataset: pd.DataFrame) -> None:
    assert not (set(full_dataset.columns) & FORBIDDEN_COLUMNS)
    assert not any("hidden" in c or "latent" in c for c in full_dataset.columns)


def test_dataset_is_chronological_and_completion_is_later(full_dataset: pd.DataFrame) -> None:
    assert full_dataset.prediction_timestamp.is_monotonic_increasing
    assert (full_dataset.completed_at > full_dataset.prediction_timestamp).all()


def test_strict_asof_overall_history() -> None:
    frame = generate_dataset(650, SEED_V3)
    for row, overall, _, _ in _independent_histories(frame):
        assert row.technician_jobs_completed_before == len(overall)
        if overall:
            assert row.technician_average_duration_before == pytest.approx(
                np.mean([x[0] for x in overall])
            )
            assert row.technician_historical_efficiency_before == pytest.approx(
                np.mean([x[1] for x in overall])
            )


def test_strict_asof_issue_history() -> None:
    frame = generate_dataset(650, SEED_V3)
    for row, _, issue, _ in _independent_histories(frame):
        assert row.technician_issue_jobs_before == len(issue)
        if issue:
            assert row.technician_issue_average_duration_before == pytest.approx(
                np.mean([x[0] for x in issue])
            )
            assert row.technician_issue_efficiency_before == pytest.approx(
                np.mean([x[1] for x in issue])
            )


def test_strict_asof_catalog_history() -> None:
    frame = generate_dataset(650, SEED_V3)
    for row, _, _, catalog in _independent_histories(frame):
        assert row.technician_catalog_jobs_before == len(catalog)
        if catalog:
            assert row.technician_catalog_average_duration_before == pytest.approx(
                np.mean([x[0] for x in catalog])
            )
            assert row.technician_catalog_efficiency_before == pytest.approx(
                np.mean([x[1] for x in catalog])
            )


def test_started_earlier_but_not_completed_is_excluded() -> None:
    base = {
        "device_type": "iPhone", "device_model": "iPhone 14", "service_issue": "Pin",
        "technical_action": "REPLACEMENT", "is_warranty": 0,
        "catalog_service": "Thay pin iPhone 14", "standard_duration_minutes": 60,
        "technician_id": "TECH_01", "branch_id": "BRANCH_01",
        "prediction_month": "M01", "prediction_weekday": "MON",
    }
    rows = [
        {**base, "sample_id": "A", "prediction_timestamp": pd.Timestamp("2026-01-01 09:00"),
         "completed_at": pd.Timestamp("2026-01-01 12:00"), TARGET: 100},
        {**base, "sample_id": "B", "prediction_timestamp": pd.Timestamp("2026-01-01 10:00"),
         "completed_at": pd.Timestamp("2026-01-01 11:00"), TARGET: 50},
        {**base, "sample_id": "C", "prediction_timestamp": pd.Timestamp("2026-01-01 11:30"),
         "completed_at": pd.Timestamp("2026-01-01 12:30"), TARGET: 55},
    ]
    result = attach_historical_features(rows)
    assert result.loc[1, "technician_jobs_completed_before"] == 0
    assert result.loc[2, "technician_jobs_completed_before"] == 1
    assert result.loc[2, "technician_average_duration_before"] == 50


def test_cold_start_counts_zero_and_statistics_missing(full_dataset: pd.DataFrame) -> None:
    cold = cold_start_examples(full_dataset[FEATURE_COLUMNS])
    new = cold.loc["new_technician"]
    assert new.technician_jobs_completed_before == 0
    assert new.technician_issue_jobs_before == 0
    assert new.technician_catalog_jobs_before == 0
    for column in [
        "technician_average_duration_before",
        "technician_historical_efficiency_before",
        "technician_issue_average_duration_before",
        "technician_issue_efficiency_before",
        "technician_catalog_average_duration_before",
        "technician_catalog_efficiency_before",
    ]:
        assert pd.isna(new[column])


def test_only_intentional_history_statistics_are_missing(full_dataset: pd.DataFrame) -> None:
    missing = set(full_dataset.columns[full_dataset.isna().any()])
    assert missing == INTENTIONAL_MISSING_COLUMNS
    for prefix in ["technician_issue", "technician_catalog"]:
        count = f"{prefix}_jobs_before"
        avg = f"{prefix}_average_duration_before"
        eff = f"{prefix}_efficiency_before"
        zero = full_dataset[count] == 0
        assert full_dataset.loc[zero, [avg, eff]].isna().all().all()


def test_temporal_development_holdout_split(full_dataset: pd.DataFrame) -> None:
    split = temporal_holdout_split(full_dataset)
    assert len(split.development) == 4250
    assert len(split.test) == 750
    assert split.development.prediction_timestamp.max() <= split.test.prediction_timestamp.min()


def test_v3_holdout_is_new_from_v2(full_dataset: pd.DataFrame) -> None:
    v2 = pd.read_csv(ML_ROOT / "data" / "synthetic_repair_duration_v2.csv")
    assert full_dataset.sample_id.iloc[0].startswith("SYN_RD_V3_")
    assert v2.sample_id.iloc[0].startswith("SYN_RD_V2_")
    assert full_dataset.prediction_timestamp.iloc[-1].isoformat() != str(v2.prediction_timestamp.iloc[-1])


def test_all_four_model_builders_and_search_spaces() -> None:
    specs = build_model_specs(smoke=False)
    assert tuple(specs) == MODEL_NAMES
    assert "model__min_samples_split" in specs["RandomForestRegressor"].parameters
    xgb = specs["XGBRegressor"].estimator.named_steps["model"]
    assert xgb.objective == "reg:squarederror"
    assert xgb.eval_metric == "mae"


def test_training_smoke_and_five_cold_starts(smoke_result) -> None:
    result, _ = smoke_result
    assert set(MODEL_NAMES).issubset(set(result.cv_table.model))
    assert result.winner_name in MODEL_NAMES
    assert set(result.cold_start_predictions) == {
        "known_history", "new_technician", "overall_but_no_issue_history",
        "issue_but_no_catalog_history", "unseen_categories",
    }
    assert np.isfinite(list(result.cold_start_predictions.values())).all()


def test_winner_selection_uses_only_cv() -> None:
    cv = pd.DataFrame([
        {"model": name, "cv_mae_mean": mae, "cv_mae_std": 1.0,
         "cv_rmse": 2.0, "cv_p90_absolute_error": 3.0}
        for name, mae in zip(MODEL_NAMES, [10.0, 11.0, 12.0, 13.0])
    ])
    winner, reason = select_winner(cv)
    assert winner == "RandomForestRegressor"
    assert "test set was not consulted" in reason


def test_near_tie_policy_uses_cv_stability() -> None:
    cv = pd.DataFrame([
        {"model": name, "cv_mae_mean": 10 + offset, "cv_mae_std": std,
         "cv_rmse": 20 + offset, "cv_p90_absolute_error": 30 + offset}
        for name, offset, std in zip(MODEL_NAMES, [0, .1, .2, 2], [2, .5, 1, .1])
    ])
    assert select_winner(cv)[0] == "HistGradientBoostingRegressor"


def test_standard_duration_baseline_is_identity() -> None:
    frame = generate_dataset(50, SEED_V3)
    np.testing.assert_array_equal(
        standard_duration_baseline(frame),
        frame.standard_duration_minutes.to_numpy(dtype=float),
    )


def test_p90_metric_is_correct() -> None:
    metrics = regression_metrics(np.zeros(10), np.arange(10, dtype=float))
    assert metrics["p90_absolute_error"] == pytest.approx(np.percentile(np.arange(10), 90))


def test_within_tolerance_metrics_are_correct() -> None:
    metrics = regression_metrics(np.zeros(4), np.array([10., 20., 40., 50.]))
    assert metrics["within_15_percent"] == 25
    assert metrics["within_30_percent"] == 50
    assert metrics["within_45_percent"] == 75


def test_committed_v3_csv_matches_generator(full_dataset: pd.DataFrame) -> None:
    committed = pd.read_csv(
        ML_ROOT / "data" / "synthetic_repair_duration_v3.csv",
        parse_dates=["prediction_timestamp", "completed_at"],
    )
    pd.testing.assert_frame_equal(committed, full_dataset, check_exact=False, rtol=1e-12)


def test_artifact_metadata_flags_and_version(smoke_result) -> None:
    _, artifact = smoke_result
    metadata = json.loads((artifact / "metadata.json").read_text(encoding="utf-8"))
    assert metadata["experiment_version"] == "V3"
    assert metadata["seed"] == SEED_V3
    assert metadata["synthetic_data"] is True
    assert metadata["production_validated"] is False
    assert metadata["runtime_integrated"] is False


def test_no_satisfaction_classification_code_reintroduced() -> None:
    paths = [
        ML_ROOT / "generate_synthetic_repair_duration_v3.py",
        ML_ROOT / "train_repair_duration_models.py",
        *sorted((ML_ROOT / "src" / "repair_duration_ml_v3").glob("*.py")),
    ]
    text = "\n".join(path.read_text(encoding="utf-8").lower() for path in paths)
    assert "confusion_matrix" not in text
    assert "roc_auc" not in text
    assert "classifier(" not in text
