"""Fair preprocessing, three model families and search spaces."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from catboost import CatBoostRegressor
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

from .config import CATEGORICAL_FEATURES, FINAL_FEATURE_COLUMNS, NUMERIC_FEATURES, SEED


@dataclass(frozen=True)
class ModelSpec:
    estimator: Any
    parameters: dict[str, list[Any]]
    preprocessing: str


class NativeCatBoostRegressor(RegressorMixin, BaseEstimator):
    """sklearn adapter preserving native categoricals and numeric NaN."""

    def __init__(self, *, categorical_features: tuple[str, ...] = tuple(CATEGORICAL_FEATURES),
                 iterations: int = 220, learning_rate: float = 0.04,
                 depth: int = 6, l2_leaf_reg: float = 5.0,
                 random_strength: float = 1.0, random_seed: int = SEED,
                 thread_count: int = 1) -> None:
        self.categorical_features = categorical_features
        self.iterations = iterations
        self.learning_rate = learning_rate
        self.depth = depth
        self.l2_leaf_reg = l2_leaf_reg
        self.random_strength = random_strength
        self.random_seed = random_seed
        self.thread_count = thread_count

    def fit(self, X, y):
        self.model_ = CatBoostRegressor(
            iterations=self.iterations, learning_rate=self.learning_rate,
            depth=self.depth, l2_leaf_reg=self.l2_leaf_reg,
            random_strength=self.random_strength, loss_function="RMSE",
            eval_metric="MAE", cat_features=list(self.categorical_features),
            random_seed=self.random_seed, verbose=False,
            allow_writing_files=False, thread_count=self.thread_count,
        )
        self.model_.fit(X, y)
        self.n_features_in_ = X.shape[1]
        self.feature_names_in_ = getattr(X, "columns", None)
        return self

    def predict(self, X):
        return self.model_.predict(X)

    def save_model(self, path) -> None:
        self.model_.save_model(path)


def feature_types(feature_columns: list[str]) -> tuple[list[str], list[str]]:
    numeric = [column for column in feature_columns if column in NUMERIC_FEATURES]
    categorical = [column for column in feature_columns if column in CATEGORICAL_FEATURES]
    if set(numeric + categorical) != set(feature_columns):
        unknown = sorted(set(feature_columns) - set(numeric) - set(categorical))
        raise ValueError(f"Features have no declared type: {unknown}")
    return numeric, categorical


def _one_hot_preprocessor(feature_columns: list[str]) -> ColumnTransformer:
    numeric, categorical = feature_types(feature_columns)
    return ColumnTransformer([
        ("numeric", SimpleImputer(strategy="median"), numeric),
        ("categorical", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=True)),
        ]), categorical),
    ])


def build_model_specs(feature_columns: list[str] | None = None, smoke: bool = False) -> dict[str, ModelSpec]:
    columns = list(feature_columns or FINAL_FEATURE_COLUMNS)
    _, categorical = feature_types(columns)
    rf_estimators = [24, 36] if smoke else [160, 240, 320]
    xgb_estimators = [30, 45] if smoke else [160, 240, 340]
    cat_iterations = [30, 45] if smoke else [160, 240, 320]
    random_forest = Pipeline([
        ("preprocessor", _one_hot_preprocessor(columns)),
        ("model", RandomForestRegressor(random_state=SEED, n_jobs=1, criterion="squared_error")),
    ])
    xgboost = Pipeline([
        ("preprocessor", _one_hot_preprocessor(columns)),
        ("model", XGBRegressor(objective="reg:squarederror", eval_metric="mae",
                               tree_method="hist", random_state=SEED, n_jobs=1)),
    ])
    catboost = NativeCatBoostRegressor(categorical_features=tuple(categorical),
                                       random_seed=SEED, thread_count=1)
    return {
        "RandomForestRegressor": ModelSpec(random_forest, {
            "model__n_estimators": rf_estimators, "model__max_depth": [None, 12, 18],
            "model__min_samples_split": [2, 6, 12], "model__min_samples_leaf": [2, 5, 10],
            "model__max_features": [0.6, 0.8, 1.0],
        }, "Training-fold median numeric imputation plus sparse one-hot encoding with unknown-category support."),
        "XGBRegressor": ModelSpec(xgboost, {
            "model__n_estimators": xgb_estimators, "model__learning_rate": [0.025, 0.05, 0.08],
            "model__max_depth": [3, 5, 7], "model__min_child_weight": [1, 4, 8],
            "model__subsample": [0.75, 0.9, 1.0], "model__colsample_bytree": [0.75, 0.9, 1.0],
            "model__reg_alpha": [0.0, 0.2, 0.8], "model__reg_lambda": [1.0, 4.0, 8.0],
        }, "Training-fold median numeric imputation plus sparse one-hot encoding; histogram trees use squared-error objective and MAE evaluation."),
        "CatBoostRegressor": ModelSpec(catboost, {
            "iterations": cat_iterations, "learning_rate": [0.025, 0.05, 0.08],
            "depth": [5, 6, 8], "l2_leaf_reg": [3.0, 7.0, 12.0],
            "random_strength": [0.4, 1.0, 1.8],
        }, "Native categorical handling and ordered statistics; numeric NaN remains native missing data."),
    }


def build_reference_xgb(feature_columns: list[str]):
    """Predeclared conservative estimator used only for development ablation."""
    return Pipeline([
        ("preprocessor", _one_hot_preprocessor(feature_columns)),
        ("model", XGBRegressor(
            n_estimators=160, learning_rate=0.05, max_depth=3,
            min_child_weight=1, subsample=1.0, colsample_bytree=0.75,
            reg_alpha=0.0, reg_lambda=8.0, objective="reg:squarederror",
            eval_metric="mae", tree_method="hist", random_state=SEED, n_jobs=1,
        )),
    ])
