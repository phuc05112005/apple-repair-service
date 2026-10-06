"""Fair model-specific preprocessing and V3 search spaces."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from catboost import CatBoostRegressor
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder
from xgboost import XGBRegressor

from .config import CATEGORICAL_FEATURES, NUMERIC_FEATURES, SEED


@dataclass(frozen=True)
class ModelSpec:
    estimator: Any
    parameters: dict[str, list[Any]]
    preprocessing: str


class NativeCatBoostRegressor(RegressorMixin, BaseEstimator):
    """sklearn-compatible adapter that retains CatBoost native categories."""

    def __init__(
        self,
        *,
        iterations: int = 220,
        learning_rate: float = 0.04,
        depth: int = 6,
        l2_leaf_reg: float = 5.0,
        random_strength: float = 1.0,
        random_seed: int = SEED,
        thread_count: int = 1,
    ) -> None:
        self.iterations = iterations
        self.learning_rate = learning_rate
        self.depth = depth
        self.l2_leaf_reg = l2_leaf_reg
        self.random_strength = random_strength
        self.random_seed = random_seed
        self.thread_count = thread_count

    def fit(self, X, y):
        self.model_ = CatBoostRegressor(
            iterations=self.iterations,
            learning_rate=self.learning_rate,
            depth=self.depth,
            l2_leaf_reg=self.l2_leaf_reg,
            random_strength=self.random_strength,
            loss_function="RMSE",
            eval_metric="MAE",
            cat_features=CATEGORICAL_FEATURES,
            random_seed=self.random_seed,
            verbose=False,
            allow_writing_files=False,
            thread_count=self.thread_count,
        )
        self.model_.fit(X, y)
        self.n_features_in_ = X.shape[1]
        self.feature_names_in_ = getattr(X, "columns", None)
        return self

    def predict(self, X):
        return self.model_.predict(X)

    def save_model(self, path) -> None:
        self.model_.save_model(path)


def _one_hot_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        [
            ("numeric", SimpleImputer(strategy="median"), NUMERIC_FEATURES),
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        (
                            "encoder",
                            OneHotEncoder(handle_unknown="ignore", sparse_output=True),
                        ),
                    ]
                ),
                CATEGORICAL_FEATURES,
            ),
        ]
    )


def _histogram_preprocessor() -> ColumnTransformer:
    transformer = ColumnTransformer(
        [
            ("numeric", SimpleImputer(strategy="median"), NUMERIC_FEATURES),
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        (
                            "encoder",
                            OrdinalEncoder(
                                handle_unknown="use_encoded_value",
                                unknown_value=-1,
                                encoded_missing_value=-1,
                                dtype=float,
                            ),
                        ),
                    ]
                ),
                CATEGORICAL_FEATURES,
            ),
        ],
        verbose_feature_names_out=False,
    )
    return transformer.set_output(transform="pandas")


def build_model_specs(smoke: bool = False) -> dict[str, ModelSpec]:
    rf_estimators = [24, 36] if smoke else [160, 240, 320]
    hgb_iterations = [30, 45] if smoke else [130, 200, 280]
    xgb_estimators = [30, 45] if smoke else [160, 240, 340]
    cat_iterations = [30, 45] if smoke else [160, 240, 320]

    random_forest = Pipeline(
        [
            ("preprocessor", _one_hot_preprocessor()),
            (
                "model",
                RandomForestRegressor(
                    random_state=SEED,
                    n_jobs=1,
                    criterion="squared_error",
                ),
            ),
        ]
    )
    histogram = Pipeline(
        [
            ("preprocessor", _histogram_preprocessor()),
            (
                "model",
                HistGradientBoostingRegressor(
                    loss="absolute_error",
                    categorical_features=CATEGORICAL_FEATURES,
                    random_state=SEED,
                ),
            ),
        ]
    )
    xgboost = Pipeline(
        [
            ("preprocessor", _one_hot_preprocessor()),
            (
                "model",
                XGBRegressor(
                    objective="reg:squarederror",
                    eval_metric="mae",
                    tree_method="hist",
                    random_state=SEED,
                    n_jobs=1,
                ),
            ),
        ]
    )
    catboost = NativeCatBoostRegressor(random_seed=SEED, thread_count=1)

    return {
        "RandomForestRegressor": ModelSpec(
            random_forest,
            {
                "model__n_estimators": rf_estimators,
                "model__max_depth": [None, 12, 18],
                "model__min_samples_split": [2, 6, 12],
                "model__min_samples_leaf": [2, 5, 10],
                "model__max_features": [0.6, 0.8, 1.0],
            },
            "Median numeric imputation and sparse one-hot categories with unknown-category support.",
        ),
        "HistGradientBoostingRegressor": ModelSpec(
            histogram,
            {
                "model__max_iter": hgb_iterations,
                "model__learning_rate": [0.035, 0.06, 0.09],
                "model__max_leaf_nodes": [15, 31, 63],
                "model__max_depth": [None, 7, 11],
                "model__min_samples_leaf": [15, 25, 40],
                "model__l2_regularization": [0.0, 1.0, 4.0],
            },
            "Median numeric imputation, dense ordinal encoding with unknown=-1, and sklearn native categorical splits.",
        ),
        "XGBRegressor": ModelSpec(
            xgboost,
            {
                "model__n_estimators": xgb_estimators,
                "model__learning_rate": [0.025, 0.05, 0.08],
                "model__max_depth": [3, 5, 7],
                "model__min_child_weight": [1, 4, 8],
                "model__subsample": [0.75, 0.9, 1.0],
                "model__colsample_bytree": [0.75, 0.9, 1.0],
                "model__reg_alpha": [0.0, 0.2, 0.8],
                "model__reg_lambda": [1.0, 4.0, 8.0],
            },
            "Median numeric imputation and sparse one-hot categories; histogram trees use reg:squarederror with MAE evaluation.",
        ),
        "CatBoostRegressor": ModelSpec(
            catboost,
            {
                "iterations": cat_iterations,
                "learning_rate": [0.025, 0.05, 0.08],
                "depth": [5, 6, 8],
                "l2_leaf_reg": [3.0, 7.0, 12.0],
                "random_strength": [0.4, 1.0, 1.8],
            },
            "Native CatBoost categoricals and ordered statistics; numeric NaN values remain native missing values.",
        ),
    }
