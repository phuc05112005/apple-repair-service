"""Regression metrics, temporal CV and diagnostic tables."""

from __future__ import annotations

from time import perf_counter
from typing import Callable

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.inspection import permutation_importance
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from .config import CATEGORICAL_FEATURES, FEATURE_COLUMNS, SEED, TARGET


def regression_metrics(y_true: pd.Series | np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    actual = np.asarray(y_true, dtype=float)
    predicted = np.asarray(y_pred, dtype=float)
    absolute_error = np.abs(actual - predicted)
    mse = float(mean_squared_error(actual, predicted))
    return {
        "mae": float(mean_absolute_error(actual, predicted)),
        "mse": mse,
        "rmse": float(np.sqrt(mse)),
        "r2": float(r2_score(actual, predicted)),
        "p90_absolute_error": float(np.percentile(absolute_error, 90)),
    }


def temporal_cv_metrics(
    estimator,
    X: pd.DataFrame,
    y: pd.Series,
    folds: list[tuple[np.ndarray, np.ndarray]],
) -> tuple[dict[str, float], list[dict[str, float]]]:
    fold_rows: list[dict[str, float]] = []
    for fold_number, (train_index, validation_index) in enumerate(folds, start=1):
        model = clone(estimator)
        started = perf_counter()
        model.fit(X.iloc[train_index], y.iloc[train_index])
        fit_seconds = perf_counter() - started
        started = perf_counter()
        predictions = model.predict(X.iloc[validation_index])
        predict_seconds = perf_counter() - started
        metrics = regression_metrics(y.iloc[validation_index], predictions)
        metrics.update(
            {
                "fold": fold_number,
                "train_rows": int(len(train_index)),
                "validation_rows": int(len(validation_index)),
                "fit_seconds": float(fit_seconds),
                "predict_seconds": float(predict_seconds),
            }
        )
        fold_rows.append(metrics)
    summary = {
        "cv_mae_mean": float(np.mean([row["mae"] for row in fold_rows])),
        "cv_mae_std": float(np.std([row["mae"] for row in fold_rows], ddof=1)),
        "cv_mse": float(np.mean([row["mse"] for row in fold_rows])),
        "cv_rmse": float(np.mean([row["rmse"] for row in fold_rows])),
        "cv_r2": float(np.mean([row["r2"] for row in fold_rows])),
        "cv_p90_absolute_error": float(
            np.mean([row["p90_absolute_error"] for row in fold_rows])
        ),
        "cv_fit_seconds": float(np.sum([row["fit_seconds"] for row in fold_rows])),
        "cv_predict_seconds": float(np.sum([row["predict_seconds"] for row in fold_rows])),
    }
    return summary, fold_rows


def temporal_baseline_metrics(
    X: pd.DataFrame,
    y: pd.Series,
    folds: list[tuple[np.ndarray, np.ndarray]],
    predictor: Callable[[pd.DataFrame, pd.Series, pd.DataFrame], np.ndarray],
) -> tuple[dict[str, float], list[dict[str, float]]]:
    fold_rows: list[dict[str, float]] = []
    for fold_number, (train_index, validation_index) in enumerate(folds, start=1):
        predictions = predictor(
            X.iloc[train_index], y.iloc[train_index], X.iloc[validation_index]
        )
        metrics = regression_metrics(y.iloc[validation_index], predictions)
        metrics.update(
            {
                "fold": fold_number,
                "train_rows": int(len(train_index)),
                "validation_rows": int(len(validation_index)),
                "fit_seconds": 0.0,
                "predict_seconds": 0.0,
            }
        )
        fold_rows.append(metrics)
    return {
        "cv_mae_mean": float(np.mean([row["mae"] for row in fold_rows])),
        "cv_mae_std": float(np.std([row["mae"] for row in fold_rows], ddof=1)),
        "cv_mse": float(np.mean([row["mse"] for row in fold_rows])),
        "cv_rmse": float(np.mean([row["rmse"] for row in fold_rows])),
        "cv_r2": float(np.mean([row["r2"] for row in fold_rows])),
        "cv_p90_absolute_error": float(
            np.mean([row["p90_absolute_error"] for row in fold_rows])
        ),
        "cv_fit_seconds": 0.0,
        "cv_predict_seconds": 0.0,
    }, fold_rows


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


def cold_start_examples(reference: pd.DataFrame) -> pd.DataFrame:
    known = reference.iloc[-1][FEATURE_COLUMNS].copy()
    no_history = known.copy()
    no_history["technician_id"] = "TECH_NEW"
    no_history["technician_jobs_completed_before"] = 0
    no_history["technician_average_duration_before"] = np.nan
    no_history["technician_issue_experience_before"] = 0
    no_history["technician_historical_efficiency_before"] = np.nan
    unseen = no_history.copy()
    unseen["device_model"] = "MODEL_CHUA_TUNG_THAY"
    unseen["catalog_service"] = "DICH_VU_CHUA_TUNG_THAY"
    result = pd.DataFrame([known, no_history, unseen], columns=FEATURE_COLUMNS)
    result.index = ["known_history", "new_technician", "unseen_categories"]
    for column in CATEGORICAL_FEATURES:
        result[column] = result[column].astype(str)
    return result
