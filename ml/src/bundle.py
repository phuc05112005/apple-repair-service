"""Đóng gói bundle: refit mô hình đã chọn trên toàn bộ dữ liệu sạch + lập metadata + kiểm tra nạp lại.
Dùng chung bởi notebook (Bước 18) và scripts/03_train_evaluate.py."""
from __future__ import annotations

import importlib.metadata as md_
import platform
from datetime import datetime

import numpy as np
import pandas as pd
import sklearn

from config.config import FEATURE_COLS, MIN_PREDICTED_MINUTES, TARGET_COL
from src.inference import interval_bounds, load_bundle, predict_minutes, save_bundle
from src.modeling import build_pipeline


def _ver(pkg: str) -> str:
    try:
        return md_.version(pkg)
    except Exception:
        return "n/a"


def fit_final_pipeline(spec, best_params: dict, df_all: pd.DataFrame):
    """Refit mô hình đã chọn (đúng tham số) trên TOÀN BỘ dữ liệu sạch (train + test).
    Hợp lệ vì mô hình đã được chọn và đánh giá xong; con số hiệu năng báo cáo vẫn là con số train-only trên test."""
    pipe = build_pipeline(spec).set_params(**best_params)
    pipe.fit(df_all[FEATURE_COLS], df_all[TARGET_COL].to_numpy(float))
    return pipe


def package_bundle(path, pipe, metadata: dict) -> None:
    """Tách pipeline thành builder + model (đúng định dạng src/inference.py) và lưu MỘT file."""
    save_bundle(path, pipe.named_steps["fe"], pipe.named_steps["est"], metadata)


def base_versions() -> dict:
    return {"python": platform.python_version(), "sklearn": sklearn.__version__, "pandas": pd.__version__,
            "numpy": np.__version__, "xgboost": _ver("xgboost"), "lightgbm": _ver("lightgbm"),
            "catboost": _ver("catboost")}


def new_version_tag() -> str:
    return f"v3-{datetime.now():%Y%m%d}"


def reload_check(path, pipe, df_all: pd.DataFrame, n: int = 5) -> pd.DataFrame:
    """Nạp bundle từ đĩa, dự đoán n phiếu, assert trùng với pipeline trong bộ nhớ (sau sàn thời gian tối thiểu)."""
    sample = df_all.sample(min(n, len(df_all)), random_state=0)
    disk = predict_minutes(sample[FEATURE_COLS], load_bundle(path))
    mem = np.maximum(pipe.predict(sample[FEATURE_COLS]), MIN_PREDICTED_MINUTES)
    assert np.allclose(disk["predicted_minutes"].to_numpy(), np.round(mem, 1), atol=0.051), "Bundle nạp lại KHÁC mô hình gốc!"
    out = disk.copy()
    out.insert(0, "thực_tế", sample[TARGET_COL].to_numpy())
    return out
