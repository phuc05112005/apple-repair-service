"""Regression metrics, temporal CV and V3 diagnostics."""

from __future__ import annotations

from time import perf_counter
from typing import Callable

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from .config import (
    CATEGORICAL_FEATURES,
    FEATURE_COLUMNS,
    SEED,
    TARGET,
    TOLERANCE_THRESHOLDS,
)


def regression_metrics(
    y_true: pd.Series | np.ndarray, y_pred: np.ndarray
) -> dict[str, float]:
    actual = np.asarray(y_true, dtype=float)
    predicted = np.asarray(y_pred, dtype=float)
    absolute_error = np.abs(actual - predicted)
    mse = float(mean_squared_error(actual, predicted))
    metrics = {
        "mae": float(mean_absolute_error(actual, predicted)),
        "mse": mse,
        "rmse": float(np.sqrt(mse)),
        "r2": float(r2_score(actual, predicted)),
        "p90_absolute_error": float(np.percentile(absolute_error, 90)),
    }
    for minutes in TOLERANCE_THRESHOLDS:
        metrics[f"within_{minutes}_percent"] = float(
            np.mean(absolute_error <= minutes) * 100.0
        )
    return metrics


def _summarize_folds(rows: list[dict[str, float]]) -> dict[str, float]:
    summary = {
        "cv_mae_mean": float(np.mean([row["mae"] for row in rows])),
        "cv_mae_std": float(np.std([row["mae"] for row in rows], ddof=1)),
        "cv_mse": float(np.mean([row["mse"] for row in rows])),
        "cv_rmse": float(np.mean([row["rmse"] for row in rows])),
        "cv_r2": float(np.mean([row["r2"] for row in rows])),
        "cv_p90_absolute_error": float(
            np.mean([row["p90_absolute_error"] for row in rows])
        ),
        "cv_fit_seconds": float(np.sum([row["fit_seconds"] for row in rows])),
        "cv_predict_seconds": float(np.sum([row["predict_seconds"] for row in rows])),
    }
    for minutes in TOLERANCE_THRESHOLDS:
        summary[f"cv_within_{minutes}_percent"] = float(
            np.mean([row[f"within_{minutes}_percent"] for row in rows])
        )
    return summary


def temporal_cv_metrics(
    estimator,
    X: pd.DataFrame,
    y: pd.Series,
    folds: list[tuple[np.ndarray, np.ndarray]],
) -> tuple[dict[str, float], list[dict[str, float]]]:
    rows: list[dict[str, float]] = []
    for fold_number, (train_index, validation_index) in enumerate(folds, start=1):
        model = clone(estimator)
        started = perf_counter()
        model.fit(X.iloc[train_index], y.iloc[train_index])
        fit_seconds = perf_counter() - started
        started = perf_counter()
        predictions = model.predict(X.iloc[validation_index])
        predict_seconds = perf_counter() - started
        row = regression_metrics(y.iloc[validation_index], predictions)
        row.update(
            {
                "fold": fold_number,
                "train_rows": int(len(train_index)),
                "validation_rows": int(len(validation_index)),
                "fit_seconds": float(fit_seconds),
                "predict_seconds": float(predict_seconds),
            }
        )
        rows.append(row)
    return _summarize_folds(rows), rows


def temporal_baseline_metrics(
    X: pd.DataFrame,
    y: pd.Series,
    folds: list[tuple[np.ndarray, np.ndarray]],
    predictor: Callable[[pd.DataFrame, pd.Series, pd.DataFrame], np.ndarray],
) -> tuple[dict[str, float], list[dict[str, float]]]:
    rows: list[dict[str, float]] = []
    for fold_number, (train_index, validation_index) in enumerate(folds, start=1):
        predictions = predictor(
            X.iloc[train_index], y.iloc[train_index], X.iloc[validation_index]
        )
        row = regression_metrics(y.iloc[validation_index], predictions)
        row.update(
            {
                "fold": fold_number,
                "train_rows": int(len(train_index)),
                "validation_rows": int(len(validation_index)),
                "fit_seconds": 0.0,
                "predict_seconds": 0.0,
            }
        )
        rows.append(row)
    return _summarize_folds(rows), rows


def subgroup_errors(
    test_frame: pd.DataFrame, predictions: np.ndarray, column: str
) -> list[dict[str, float | int | str]]:
    scored = test_frame[[column, TARGET]].copy()
    scored["prediction"] = predictions
    rows: list[dict[str, float | int | str]] = []
    for value, group in scored.groupby(column, observed=True):
        actual = group[TARGET].to_numpy(dtype=float)
        predicted = group["prediction"].to_numpy(dtype=float)
        rows.append(
            {
                "group": str(value),
                "sample_count": int(len(group)),
                "mae": float(mean_absolute_error(actual, predicted)),
                "rmse": float(np.sqrt(mean_squared_error(actual, predicted))),
            }
        )
    return sorted(rows, key=lambda row: (-float(row["mae"]), -int(row["sample_count"])))


def feature_importance(
    estimator, X_test: pd.DataFrame, y_test: pd.Series
) -> list[dict[str, float | str]]:
    result = permutation_importance(
        estimator,
        X_test,
        y_test,
        scoring="neg_mean_absolute_error",
        n_repeats=5,
        random_state=SEED,
        n_jobs=1,
    )
    rows = [
        {
            "feature": feature,
            "importance_mean_mae_increase": float(mean),
            "importance_std": float(std),
        }
        for feature, mean, std in zip(
            FEATURE_COLUMNS, result.importances_mean, result.importances_std
        )
    ]
    return sorted(rows, key=lambda row: -float(row["importance_mean_mae_increase"]))


def _clear_overall_history(row: pd.Series) -> None:
    row["technician_jobs_completed_before"] = 0
    row["technician_average_duration_before"] = np.nan
    row["technician_historical_efficiency_before"] = np.nan


def _clear_issue_history(row: pd.Series) -> None:
    row["technician_issue_jobs_before"] = 0
    row["technician_issue_average_duration_before"] = np.nan
    row["technician_issue_efficiency_before"] = np.nan


def _clear_catalog_history(row: pd.Series) -> None:
    row["technician_catalog_jobs_before"] = 0
    row["technician_catalog_average_duration_before"] = np.nan
    row["technician_catalog_efficiency_before"] = np.nan


def cold_start_examples(reference: pd.DataFrame) -> pd.DataFrame:
    """Build five explicit cold-start scenarios without inventing history."""
    known = reference.iloc[-1][FEATURE_COLUMNS].copy()

    new_technician = known.copy()
    new_technician["technician_id"] = "TECH_NEW"
    _clear_overall_history(new_technician)
    _clear_issue_history(new_technician)
    _clear_catalog_history(new_technician)

    overall_candidates = reference[
        reference["technician_jobs_completed_before"].astype(float) > 0
    ]
    no_issue = (
        overall_candidates.iloc[-1][FEATURE_COLUMNS].copy()
        if not overall_candidates.empty
        else known.copy()
    )
    _clear_issue_history(no_issue)
    _clear_catalog_history(no_issue)

    issue_candidates = reference[
        reference["technician_issue_jobs_before"].astype(float) > 0
    ]
    no_catalog = (
        issue_candidates.iloc[-1][FEATURE_COLUMNS].copy()
        if not issue_candidates.empty
        else known.copy()
    )
    _clear_catalog_history(no_catalog)

    unseen = new_technician.copy()
    unseen["device_model"] = "MODEL_CHUA_TUNG_THAY"
    unseen["service_issue"] = "VAN_DE_CHUA_TUNG_THAY"
    unseen["catalog_service"] = "DICH_VU_CHUA_TUNG_THAY"
    unseen["branch_id"] = "BRANCH_NEW"

    result = pd.DataFrame(
        [known, new_technician, no_issue, no_catalog, unseen],
        columns=FEATURE_COLUMNS,
    )
    result.index = [
        "known_history",
        "new_technician",
        "overall_but_no_issue_history",
        "issue_but_no_catalog_history",
        "unseen_categories",
    ]
    for column in CATEGORICAL_FEATURES:
        result[column] = result[column].astype(str)
    return result
