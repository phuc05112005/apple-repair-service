"""Tạo mô hình + quy trình fit/predict không rò rỉ (builder fit CHỈ trên dữ liệu train của lần đó)."""
import numpy as np
import pandas as pd

from config.config import CAT_COLS, ISSUE_COL, NUM_COLS, RANDOM_STATE, TARGET_COL
from src.augment import augment_repair_dataset
from src.features import RepairFeatureBuilder


def make_model(params: dict, seed: int = RANDOM_STATE):
    from xgboost import XGBRegressor
    return XGBRegressor(objective="reg:squarederror", random_state=seed, n_jobs=-1, **params)


def new_builder() -> RepairFeatureBuilder:
    return RepairFeatureBuilder(NUM_COLS, CAT_COLS, ISSUE_COL)


def fit_model(train_df: pd.DataFrame, params: dict, augment: bool = False, augment_rows: int = 3000, seed: int = RANDOM_STATE):
    if augment:
        train_df = augment_repair_dataset(train_df, augment_rows, seed)
    builder = new_builder().fit(train_df)
    model = make_model(params, seed).fit(builder.transform(train_df), train_df[TARGET_COL].to_numpy(float))
    return builder, model


def fit_predict(train_df, test_df, params, augment=False, augment_rows=3000, seed=RANDOM_STATE) -> np.ndarray:
    builder, model = fit_model(train_df, params, augment, augment_rows, seed)
    return model.predict(builder.transform(test_df))
