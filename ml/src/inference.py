"""Nạp bundle và dự đoán. Dùng bởi 05 (demo), 06 (DB service), 07 (giám sát) và app.py (API).
Bundle = {builder, model, metadata}. builder.transform(bảng thô) -> ma trận đặc trưng; model.predict(ma trận)."""
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
        raise FileNotFoundError(f"Chưa có model tại {path}. Chạy notebook model_selection.ipynb (Run All) "
                                f"hoặc scripts/03_train_evaluate.py trước.")
    mtime = path.stat().st_mtime
    hit = _CACHE.get(str(path))
    if hit and hit[0] == mtime:
        return hit[1]
    bundle = Bundle(**joblib.load(path))
    _CACHE[str(path)] = (mtime, bundle)
    return bundle


def interval_bounds(pred, metadata: dict, min_minutes: float = MIN_PREDICTED_MINUTES):
    """Khoảng dự báo từ dự đoán + metadata. Hai kiểu (chọn lúc huấn luyện, lưu trong metadata):
      - 'absolute': ŷ ± q          - 'relative': ŷ·(1 ± q_rel)
    Bundle cũ (không có interval_method) được hiểu là 'absolute' với q = interval_halfwidth_minutes."""
    pred = np.maximum(np.asarray(pred, float), min_minutes)
    if metadata.get("interval_method") == "relative":
        half = pred * float(metadata["interval_q_rel"])
    else:
        half = np.full_like(pred, float(metadata.get("interval_q_abs", metadata.get("interval_halfwidth_minutes", 0.0))))
    return np.maximum(pred - half, min_minutes), pred + half


def predict_minutes(df: pd.DataFrame, bundle: Bundle | None = None) -> pd.DataFrame:
    """Trả về DataFrame: predicted_minutes, lower_minutes, upper_minutes (khoảng ~90%)."""
    bundle = bundle or load_bundle()
    pred = np.maximum(np.asarray(bundle.model.predict(bundle.builder.transform(df)), float), MIN_PREDICTED_MINUTES)
    lo, hi = interval_bounds(pred, bundle.metadata)
    return pd.DataFrame({
        "predicted_minutes": np.round(pred, 1),
        "lower_minutes": np.round(lo, 1),
        "upper_minutes": np.round(hi, 1),
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
