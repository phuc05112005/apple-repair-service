"""End-to-end V3 temporal model competition and artifact writer."""

from __future__ import annotations

import hashlib
import json
import os
import platform
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Any
from zoneinfo import ZoneInfo

# The Windows image used for verification has no legacy ``wmic`` executable.
# A conservative explicit cap prevents joblib from probing it and does not
# change estimator-level thread settings (all candidates are already pinned).
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

import catboost
import joblib
import numpy as np
import pandas as pd
import sklearn
import xgboost
from matplotlib import pyplot as plt
from sklearn.base import clone
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit

from .config import (
    CATEGORICAL_FEATURES,
    CV_SPLITS,
    DEFAULT_SEARCH_ITERATIONS,
    EXPERIMENT_VERSION,
    FEATURE_COLUMNS,
    INTENTIONAL_MISSING_COLUMNS,
    MODEL_NAMES,
    NEAR_TIE_MINUTES,
    NUMERIC_FEATURES,
    OUTPUT_COLUMNS,
    SEED,
    TARGET,
    TEST_FRACTION,
    TIME_COLUMN,
)
from .data import feature_target, load_dataset, temporal_holdout_split
from .evaluation import (
    cold_start_examples,
    feature_importance,
    regression_metrics,
    subgroup_errors,
    temporal_baseline_metrics,
    temporal_cv_metrics,
)
from .models import ModelSpec, NativeCatBoostRegressor, build_model_specs

@dataclass
class CompetitionResult:
    winner_name: str
    winner_estimator: Any
    winner_reason: str
    cv_table: pd.DataFrame
    test_table: pd.DataFrame
    best_parameters: dict[str, dict[str, Any]]
    fold_metrics: dict[str, list[dict[str, Any]]]
    subgroup_metrics: dict[str, list[dict[str, Any]]]
    feature_importances: list[dict[str, Any]]
    cold_start_predictions: dict[str, float]
    test_predictions: np.ndarray
    split_summary: dict[str, Any]
    search_spaces: dict[str, dict[str, list[Any]]]
    preprocessing: dict[str, str]


def _json_default(value: Any) -> Any:
    if isinstance(value, (np.integer, np.floating)):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    raise TypeError(f"Cannot JSON-encode {type(value).__name__}")


def _json_write(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, default=_json_default) + "\n",
        encoding="utf-8",
    )


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _complexity_rank(model_name: str) -> int:
    return {
        "HistGradientBoostingRegressor": 1,
        "RandomForestRegressor": 2,
        "XGBRegressor": 3,
        "CatBoostRegressor": 4,
    }[model_name]


def select_winner(cv_table: pd.DataFrame) -> tuple[str, str]:
    """Select exclusively from development CV metrics, never holdout metrics."""
    candidates = cv_table[cv_table["model"].isin(MODEL_NAMES)].copy()
    if set(candidates["model"]) != set(MODEL_NAMES):
        raise ValueError("CV table must contain all four candidate models")
    best_mae = float(candidates["cv_mae_mean"].min())
    near_ties = candidates[
        candidates["cv_mae_mean"] <= best_mae + NEAR_TIE_MINUTES
    ].copy()
    near_ties["complexity_rank"] = near_ties["model"].map(_complexity_rank)
    locked = near_ties.sort_values(
        [
            "cv_mae_std",
            "cv_rmse",
            "cv_p90_absolute_error",
            "complexity_rank",
            "cv_mae_mean",
        ],
        kind="stable",
    ).iloc[0]
    winner = str(locked["model"])
    if len(near_ties) == 1:
        reason = (
            f"{winner} had the lowest development temporal-CV MAE "
            f"({float(locked['cv_mae_mean']):.3f} minutes); the untouched test set "
            "was not consulted."
        )
    else:
        tied_names = ", ".join(near_ties["model"].tolist())
        reason = (
            f"Models within {NEAR_TIE_MINUTES:.2f} minute of the best CV MAE were "
            f"treated as a practical tie ({tied_names}). {winner} was locked using, "
            "in order, lower CV-MAE standard deviation, CV RMSE, CV P90 absolute "
            "error and implementation-complexity rank. The test set was not consulted."
        )
    return winner, reason


def _baseline_cv_rows(
    X_dev: pd.DataFrame,
    y_dev: pd.Series,
    folds: list[tuple[np.ndarray, np.ndarray]],
) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    mean_summary, mean_folds = temporal_baseline_metrics(
        X_dev,
        y_dev,
        folds,
        lambda _train_x, train_y, validation_x: np.full(
            len(validation_x), float(train_y.mean())
        ),
    )
    standard_summary, standard_folds = temporal_baseline_metrics(
        X_dev,
        y_dev,
        folds,
        lambda _train_x, _train_y, validation_x: validation_x[
            "standard_duration_minutes"
        ].to_numpy(dtype=float),
    )
    return [
        {"model": "MeanBaseline", **mean_summary},
        {"model": "StandardDurationBaseline", **standard_summary},
    ], {
        "MeanBaseline": mean_folds,
        "StandardDurationBaseline": standard_folds,
    }


def _tune_candidate(
    model_name: str,
    spec: ModelSpec,
    X_dev: pd.DataFrame,
    y_dev: pd.Series,
    folds: list[tuple[np.ndarray, np.ndarray]],
    search_iterations: int,
) -> tuple[Any, dict[str, Any], dict[str, float], list[dict[str, Any]], float]:
    started = perf_counter()
    search = RandomizedSearchCV(
        estimator=spec.estimator,
        param_distributions=spec.parameters,
        n_iter=search_iterations,
        scoring="neg_mean_absolute_error",
        cv=folds,
        random_state=SEED,
        n_jobs=1,
        refit=False,
        return_train_score=False,
        error_score="raise",
    )
    search.fit(X_dev, y_dev)
    search_seconds = perf_counter() - started
    best_index = int(np.argmax(search.cv_results_["mean_test_score"]))
    best_parameters = dict(search.cv_results_["params"][best_index])
    best_estimator = clone(spec.estimator).set_params(**best_parameters)
    cv_summary, fold_rows = temporal_cv_metrics(best_estimator, X_dev, y_dev, folds)
    cv_summary["search_seconds"] = float(search_seconds)
    return best_estimator, best_parameters, cv_summary, fold_rows, search_seconds


def _test_candidate(
    estimator,
    X_dev: pd.DataFrame,
    y_dev: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> tuple[Any, np.ndarray, dict[str, float]]:
    model = clone(estimator)
    started = perf_counter()
    model.fit(X_dev, y_dev)
    fit_seconds = perf_counter() - started
    started = perf_counter()
    predictions = np.asarray(model.predict(X_test), dtype=float)
    predict_seconds = perf_counter() - started
    return model, predictions, {
        **regression_metrics(y_test, predictions),
        "fit_seconds": float(fit_seconds),
        "predict_seconds": float(predict_seconds),
    }


def run_competition(
    data_path: str | Path,
    *,
    output_dir: str | Path | None = None,
    cv_splits: int = CV_SPLITS,
    test_fraction: float = TEST_FRACTION,
    search_iterations: int = DEFAULT_SEARCH_ITERATIONS,
    smoke: bool = False,
) -> CompetitionResult:
    """Run the fair V3 competition and optionally persist the winner artifact."""
    if not smoke and not 12 <= search_iterations <= 16:
        raise ValueError("Full V3 search requires 12 to 16 configurations per model")
    np.random.seed(SEED)
    data_path = Path(data_path).resolve()
    frame = load_dataset(data_path)
    split = temporal_holdout_split(frame, test_fraction)
    X_dev, y_dev = feature_target(split.development)
    X_test, y_test = feature_target(split.test)
    if cv_splits < 2:
        raise ValueError("At least two temporal CV folds are required")
    folds = list(TimeSeriesSplit(n_splits=cv_splits).split(X_dev))

    cv_rows, fold_metrics = _baseline_cv_rows(X_dev, y_dev, folds)
    specs = build_model_specs(smoke=smoke)
    best_estimators: dict[str, Any] = {}
    best_parameters: dict[str, dict[str, Any]] = {}
    for model_name in MODEL_NAMES:
        spec = specs[model_name]
        estimator, parameters, summary, model_folds, _ = _tune_candidate(
            model_name,
            spec,
            X_dev,
            y_dev,
            folds,
            search_iterations,
        )
        best_estimators[model_name] = estimator
        best_parameters[model_name] = parameters
        fold_metrics[model_name] = model_folds
        cv_rows.append({"model": model_name, **summary})

    cv_table = pd.DataFrame(cv_rows).sort_values("cv_mae_mean", kind="stable")
    winner_name, winner_reason = select_winner(cv_table)

    test_rows: list[dict[str, Any]] = []
    mean_predictions = np.full(len(y_test), float(y_dev.mean()))
    standard_predictions = X_test["standard_duration_minutes"].to_numpy(dtype=float)
    test_rows.extend(
        [
            {"model": "MeanBaseline", **regression_metrics(y_test, mean_predictions), "fit_seconds": 0.0, "predict_seconds": 0.0},
            {"model": "StandardDurationBaseline", **regression_metrics(y_test, standard_predictions), "fit_seconds": 0.0, "predict_seconds": 0.0},
        ]
    )
    fitted_models: dict[str, Any] = {}
    model_predictions: dict[str, np.ndarray] = {}
    for model_name in MODEL_NAMES:
        fitted, predictions, metrics = _test_candidate(
            best_estimators[model_name], X_dev, y_dev, X_test, y_test
        )
        fitted_models[model_name] = fitted
        model_predictions[model_name] = predictions
        test_rows.append({"model": model_name, **metrics})
    test_table = pd.DataFrame(test_rows).sort_values("mae", kind="stable")

    winner_estimator = fitted_models[winner_name]
    winner_predictions = model_predictions[winner_name]
    subgroup_metrics = {
        column: subgroup_errors(split.test, winner_predictions, column)
        for column in [
            "technician_id",
            "device_type",
            "service_issue",
            "technical_action",
            "is_warranty",
        ]
    }
    importances = feature_importance(winner_estimator, X_test, y_test)
    cold_rows = cold_start_examples(X_dev)
    cold_predictions = {
        name: float(value)
        for name, value in zip(cold_rows.index, winner_estimator.predict(cold_rows))
    }
    if not all(np.isfinite(list(cold_predictions.values()))):
        raise ValueError("Winner produced a non-finite cold-start prediction")

    result = CompetitionResult(
        winner_name=winner_name,
        winner_estimator=winner_estimator,
        winner_reason=winner_reason,
        cv_table=cv_table.reset_index(drop=True),
        test_table=test_table.reset_index(drop=True),
        best_parameters=best_parameters,
        fold_metrics=fold_metrics,
        subgroup_metrics=subgroup_metrics,
        feature_importances=importances,
        cold_start_predictions=cold_predictions,
        test_predictions=winner_predictions,
        split_summary={
            "policy": f"earliest {100 * (1 - test_fraction):.0f}% development; latest {100 * test_fraction:.0f}% untouched holdout",
            "development_rows": int(len(split.development)),
            "test_rows": int(len(split.test)),
            "development_start": split.development[TIME_COLUMN].min().isoformat(),
            "development_end": split.development[TIME_COLUMN].max().isoformat(),
            "test_start": split.test[TIME_COLUMN].min().isoformat(),
            "test_end": split.test[TIME_COLUMN].max().isoformat(),
            "cv": f"TimeSeriesSplit(n_splits={cv_splits}) on development only",
            "folds": [
                {
                    "fold": index,
                    "train_rows": int(len(train_index)),
                    "validation_rows": int(len(validation_index)),
                    "train_end": split.development.iloc[train_index][TIME_COLUMN].max().isoformat(),
                    "validation_start": split.development.iloc[validation_index][TIME_COLUMN].min().isoformat(),
                    "validation_end": split.development.iloc[validation_index][TIME_COLUMN].max().isoformat(),
                }
                for index, (train_index, validation_index) in enumerate(folds, start=1)
            ],
        },
        search_spaces={name: spec.parameters for name, spec in specs.items()},
        preprocessing={name: spec.preprocessing for name, spec in specs.items()},
    )
    if output_dir is not None:
        save_experiment(result, frame, split.test, data_path, Path(output_dir))
    return result


def _save_diagnostics(
    path: Path, actual: pd.Series, predictions: np.ndarray
) -> None:
    residuals = actual.to_numpy(dtype=float) - predictions
    absolute_errors = np.abs(residuals)
    figure, axes = plt.subplots(2, 2, figsize=(12, 9))
    axes[0, 0].scatter(actual, predictions, alpha=0.35, s=14)
    lower = min(float(actual.min()), float(predictions.min()))
    upper = max(float(actual.max()), float(predictions.max()))
    axes[0, 0].plot([lower, upper], [lower, upper], linestyle="--", color="black")
    axes[0, 0].set(title="Actual vs predicted", xlabel="Actual minutes", ylabel="Predicted minutes")
    axes[0, 1].scatter(predictions, residuals, alpha=0.35, s=14)
    axes[0, 1].axhline(0, linestyle="--", color="black")
    axes[0, 1].set(title="Residual vs predicted", xlabel="Predicted minutes", ylabel="Residual (actual - predicted)")
    axes[1, 0].hist(residuals, bins=35)
    axes[1, 0].set(title="Residual distribution", xlabel="Residual minutes")
    axes[1, 1].hist(absolute_errors, bins=35)
    axes[1, 1].axvline(np.percentile(absolute_errors, 90), color="red", linestyle="--", label="P90 AE")
    axes[1, 1].legend()
    axes[1, 1].set(title="Absolute-error distribution", xlabel="Absolute error minutes")
    figure.tight_layout()
    figure.savefig(path, dpi=150)
    plt.close(figure)


def save_experiment(
    result: CompetitionResult,
    frame: pd.DataFrame,
    test_frame: pd.DataFrame,
    data_path: Path,
    output_dir: Path,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    repository_root = Path(__file__).resolve().parents[3]
    try:
        dataset_path = data_path.resolve().relative_to(repository_root).as_posix()
    except ValueError:
        dataset_path = data_path.name
    result.cv_table.to_csv(output_dir / "development_cv_comparison.csv", index=False)
    result.test_table.to_csv(output_dir / "test_comparison.csv", index=False)
    pd.DataFrame(result.feature_importances).to_csv(
        output_dir / "feature_importance.csv", index=False
    )
    predictions = test_frame[["sample_id", TIME_COLUMN, TARGET]].copy()
    predictions["predicted_technical_minutes"] = result.test_predictions
    predictions["residual_minutes"] = predictions[TARGET] - result.test_predictions
    predictions["absolute_error_minutes"] = np.abs(predictions["residual_minutes"])
    predictions.to_csv(output_dir / "test_predictions.csv", index=False)
    _save_diagnostics(
        output_dir / "diagnostics.png", test_frame[TARGET], result.test_predictions
    )

    model_path: Path
    artifact_format: str
    if isinstance(result.winner_estimator, NativeCatBoostRegressor):
        model_path = output_dir / "model.cbm"
        result.winner_estimator.save_model(model_path)
        artifact_format = "CatBoost native CBM; consumes a pandas frame matching feature_contract.json"
    else:
        model_path = output_dir / "model.joblib"
        joblib.dump(result.winner_estimator, model_path)
        artifact_format = "joblib containing the fitted preprocessing pipeline and estimator"

    cv_records = result.cv_table.to_dict(orient="records")
    test_records = result.test_table.to_dict(orient="records")
    standard_test = next(row for row in test_records if row["model"] == "StandardDurationBaseline")
    winner_test = next(row for row in test_records if row["model"] == result.winner_name)
    improvement = float(standard_test["mae"] - winner_test["mae"])
    improvement_percent = float(improvement / standard_test["mae"] * 100.0)
    metrics = {
        "development_cv": cv_records,
        "untouched_test": test_records,
        "winner": result.winner_name,
        "winner_reason": result.winner_reason,
        "winner_improvement_vs_standard_duration_mae_minutes": improvement,
        "winner_improvement_vs_standard_duration_mae_percent": improvement_percent,
        "fold_metrics": result.fold_metrics,
        "subgroup_errors": result.subgroup_metrics,
        "cold_start_predictions": result.cold_start_predictions,
        "feature_importance": result.feature_importances,
    }
    _json_write(output_dir / "metrics.json", metrics)

    metadata = {
        "artifact_label": "EXPERIMENTAL — SYNTHETIC-DATA TRAINED — NOT PRODUCTION VALIDATED",
        "experiment_version": EXPERIMENT_VERSION,
        "training_timestamp": datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).isoformat(),
        "seed": SEED,
        "dataset_path": dataset_path,
        "dataset_sha256": sha256_file(data_path),
        "dataset_rows": int(len(frame)),
        "dataset_columns": int(len(frame.columns)),
        "features": FEATURE_COLUMNS,
        "target": TARGET,
        "sample_grain": "completed ticket with exactly one APPROVED repair item, one concrete catalog item, exactly one ended assignment, no accepted transfer, complete ordered status history, and positive target",
        "target_semantics": "minutes in INSPECTING and REPAIRING intersected with the assignment interval",
        "warranty_semantics": "is_warranty derives from warranty_source_item_id; technical_action resolves to REPAIR or REPLACEMENT from the repair item remedy, catalog remedy, or actual technical catalog",
        "split_policy": result.split_summary,
        "cv_policy": "same TimeSeriesSplit folds for all candidates; MAE primary; test excluded from selection",
        "winner_name": result.winner_name,
        "winner_selection_reason": result.winner_reason,
        "winner_hyperparameters": result.best_parameters[result.winner_name],
        "all_best_hyperparameters": result.best_parameters,
        "search_spaces": result.search_spaces,
        "preprocessing": result.preprocessing,
        "cv_metrics": next(row for row in cv_records if row["model"] == result.winner_name),
        "test_metrics": winner_test,
        "model_file": model_path.name,
        "artifact_format": artifact_format,
        "artifact_size_bytes": int(model_path.stat().st_size),
        "library_versions": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scikit_learn": sklearn.__version__,
            "xgboost": xgboost.__version__,
            "catboost": catboost.__version__,
            "joblib": joblib.__version__,
        },
        "synthetic_data": True,
        "production_validated": False,
        "runtime_integrated": False,
    }
    _json_write(output_dir / "metadata.json", metadata)

    feature_contract = {
        "contract_version": "repair-duration-features-v3",
        "prediction_timestamp": "first assignment time after the approved single-item plan is known",
        "features_in_order": FEATURE_COLUMNS,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "intentional_missing_features": sorted(INTENTIONAL_MISSING_COLUMNS),
        "target": TARGET,
        "non_feature_columns": ["sample_id", TIME_COLUMN, "completed_at", TARGET],
        "schema": OUTPUT_COLUMNS,
        "history_as_of_rule": "previous_job.completed_at < current_prediction_timestamp",
        "cold_start": "overall, issue and catalog counts are zero where absent; corresponding averages and efficiencies remain missing",
        "warranty_mapping": {
            "is_warranty": "repair_items.warranty_source_item_id IS NOT NULL",
            "technical_action": "normalize repair_items.warranty_remedy, service_catalog_items.warranty_remedy, or actual technical catalog to REPAIR|REPLACEMENT",
            "legacy_service_type": "service_types.code WARRANTY remains for compatibility and is not an ML technical action",
        },
        "service_interruption_limitation": "persisted service interruptions are not yet subtracted by production duration services",
        "synthetic_domain": True,
    }
    _json_write(output_dir / "feature_contract.json", feature_contract)
    _json_write(output_dir / "subgroup_errors.json", result.subgroup_metrics)
    _json_write(output_dir / "cv_fold_metrics.json", result.fold_metrics)
