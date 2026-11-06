"""Nạp bundle và dự đoán. Dùng bởi 05 (demo), 06 (DB service) và app.py (API)."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from config.config import BUNDLE_PATH, MIN_PREDICTED_MINUTES


@dataclass
class Bundle:
    builder: object
    model: object
    metadata: dict

    @property
    def technician_ids(self) -> list[int]:
        return list(self.builder.categories_.get("technician_id", []))


_CACHE: dict = {}


def save_bundle(path: Path, builder, model, metadata: dict) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"builder": builder, "model": model, "metadata": metadata}, path)


def load_bundle(path: Path = BUNDLE_PATH) -> Bundle:
    """Nạp 1 lần, tự nạp lại khi file model đổi (retrain xong không cần restart service)."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Chưa có model tại {path}. Chạy scripts/03_train_evaluate.py trước.")
    mtime = path.stat().st_mtime
    hit = _CACHE.get(str(path))
    if hit and hit[0] == mtime:
        return hit[1]
    raw = joblib.load(path)
    bundle = Bundle(**raw)
    _CACHE[str(path)] = (mtime, bundle)
    return bundle


def predict_minutes(df: pd.DataFrame, bundle: Bundle | None = None) -> pd.DataFrame:
    """Trả về DataFrame: predicted_minutes, lower_minutes, upper_minutes (khoảng ~90%)."""
    bundle = bundle or load_bundle()
    pred = np.maximum(bundle.model.predict(bundle.builder.transform(df)), MIN_PREDICTED_MINUTES)
    q = float(bundle.metadata.get("interval_halfwidth_minutes", 0.0))
    return pd.DataFrame({
        "predicted_minutes": np.round(pred, 1),
        "lower_minutes": np.round(np.maximum(pred - q, MIN_PREDICTED_MINUTES), 1),
        "upper_minutes": np.round(pred + q, 1),
    }, index=df.index)


def predict_for_technician_ids(features_row: pd.DataFrame, technician_ids: list[int], bundle: Bundle | None = None) -> pd.DataFrame:
    """Cùng 1 phiếu, thử lần lượt từng KTV ('what-if'). features_row: đúng 1 dòng."""
    bundle = bundle or load_bundle()
    rows = pd.concat([features_row.iloc[[0]]] * len(technician_ids), ignore_index=True)
    rows["technician_id"] = list(technician_ids)
    out = predict_minutes(rows, bundle)
    out.insert(0, "technician_id", list(technician_ids))
    return out


def predict_mean_over_technicians(features_row: pd.DataFrame, bundle: Bundle | None = None) -> dict:
    """Phiếu CHƯA phân công KTV: lấy trung bình trên các KTV đã biết."""
    bundle = bundle or load_bundle()
    res = predict_for_technician_ids(features_row, bundle.technician_ids, bundle)
    return {c: float(res[c].mean()) for c in ("predicted_minutes", "lower_minutes", "upper_minutes")}
