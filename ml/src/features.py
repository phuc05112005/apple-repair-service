"""Làm sạch dữ liệu + tạo đặc trưng. Dùng CHUNG cho train và inference.
Class nằm trong module (không phải notebook/__main__) nên joblib nạp lại được ở mọi nơi.

RepairFeatureBuilder tuân theo API của scikit-learn (fit/transform/clone được) nên có thể đặt làm bước đầu của
Pipeline: khi cross-validation, bộ mã hóa được fit lại CHỈ trên phần train của từng fold (không rò rỉ vocabulary)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

SERVICES_COL = "total_services_count"
CATALOG_COL = "total_catalog_standard_duration_minutes"


def parse_issue_ids(value) -> list[int]:
    """'1, 6' -> [1, 6]. Chịu được None/NaN/khoảng trắng/dấu phẩy thừa."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return []
    return sorted({int(p) for p in str(value).replace(" ", "").split(",") if p.isdigit()})


def issue_key(value) -> str:
    return ",".join(map(str, parse_issue_ids(value)))


def clean_training_data(df: pd.DataFrame, target_col: str, group_col: str,
                        max_minutes: float = 480.0) -> tuple[pd.DataFrame, dict]:
    """Làm sạch dữ liệu huấn luyện. Trả về (df sạch, báo cáo từng luật) để đưa vào báo cáo đồ án.
    Mỗi luật chỉ đếm những dòng bị loại BỞI RIÊNG luật đó (áp tuần tự)."""
    rep = {"rows_raw": int(len(df))}
    out = df.copy()

    # Luật 1: phiếu chuyển giao KTV -> nhãn là thời gian trộn của nhiều người
    if "is_reassigned" in out.columns:
        mask = out["is_reassigned"].fillna(0) != 0
        rep["dropped_reassigned"] = int(mask.sum())
        out = out[~mask]
    else:
        rep["dropped_reassigned"] = 0

    # Luật 2: nhãn không hợp lệ hoặc phiếu không có hạng mục
    before = len(out)
    out = out.dropna(subset=[target_col])
    out = out[(out[target_col] > 0) & (out[SERVICES_COL] > 0)]
    rep["dropped_invalid_target_or_no_service"] = int(before - len(out))

    # Luật 3: thiếu KTV (không thể dự đoán "theo KTV")
    before = len(out)
    out = out.dropna(subset=["technician_id"])
    out = out[out["technician_id"] != 0]
    rep["dropped_missing_technician"] = int(before - len(out))

    # Luật 4: nhãn phi thực tế (quên đóng phiếu...). Chỉ loại các giá trị cực đoan, KHÔNG cắt ngoại lai thông thường.
    before = len(out)
    out = out[out[target_col] <= max_minutes]
    rep["dropped_implausible_duration"] = int(before - len(out))

    # Luật 5: mỗi phiếu đúng một dòng (một phiếu ở cả train lẫn test là rò rỉ)
    before = len(out)
    out = out.drop_duplicates(subset=group_col, keep="first")
    rep["dropped_duplicate_tickets"] = int(before - len(out))

    rep["rows_clean"] = int(len(out))
    return out.reset_index(drop=True), rep


def _as_int_str(series: pd.Series) -> np.ndarray:
    """ID -> chuỗi số nguyên nhất quán (5343.0 và 5343 đều thành '5343'); thiếu -> '-1'."""
    return pd.to_numeric(series, errors="coerce").fillna(-1).astype(int).astype(str).to_numpy()


class RepairFeatureBuilder(TransformerMixin, BaseEstimator):
    """Bảng thô -> ma trận đặc trưng. Hai chế độ mã hóa biến định danh:
      - 'ohe'   : One-Hot đầy đủ (Ridge, Cây, RF, XGBoost, LightGBM).
      - 'native': giữ ID dạng chuỗi (CatBoost tự mã hóa bằng ordered target statistics).
    Giá trị chưa từng thấy lúc fit -> toàn số 0 ở 'ohe' (không báo lỗi); dùng unknown_values() để cảnh báo."""

    def __init__(self, num_cols, cat_cols, issue_col, cat_mode: str = "ohe"):
        # QUAN TRỌNG: gán nguyên giá trị tham số (không copy/đổi) để sklearn.clone() hoạt động.
        self.num_cols = num_cols
        self.cat_cols = cat_cols
        self.issue_col = issue_col
        self.cat_mode = cat_mode

    # ------------------------------------------------------------------ fit
    def fit(self, X: pd.DataFrame, y=None):
        num_cols, cat_cols = list(self.num_cols), list(self.cat_cols)
        assert SERVICES_COL in num_cols and CATALOG_COL in num_cols, "Thiếu cột số dịch vụ / định mức catalog"
        assert self.cat_mode in ("ohe", "native")
        self.issue_vocab_ = sorted({i for v in X[self.issue_col] for i in parse_issue_ids(v)})
        self.categories_ = {
            c: sorted(pd.to_numeric(X[c], errors="coerce").dropna().astype(int).unique().tolist())
            for c in cat_cols
        }
        base = num_cols + ["duration_per_service", "log_catalog"] + [f"issue_{k}" for k in self.issue_vocab_]
        if self.cat_mode == "native":
            self.feature_names_ = base + cat_cols
        else:
            self.feature_names_ = base + [f"{c}__{v}" for c in cat_cols for v in self.categories_[c]]
        self.categorical_features_ = cat_cols if self.cat_mode == "native" else []
        return self

    # ------------------------------------------------------------------ transform
    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        n = len(X)
        num_cols, cat_cols = list(self.num_cols), list(self.cat_cols)
        data = {c: pd.to_numeric(X[c], errors="coerce").fillna(0.0).to_numpy(float) for c in num_cols}
        cnt, cat = data[SERVICES_COL], data[CATALOG_COL]
        data["duration_per_service"] = np.divide(cat, cnt, out=np.zeros(n), where=cnt > 0)
        data["log_catalog"] = np.log1p(np.clip(cat, 0.0, None))

        parsed = [set(parse_issue_ids(v)) for v in X[self.issue_col]]
        for k in self.issue_vocab_:
            data[f"issue_{k}"] = np.array([k in s for s in parsed], dtype=float)

        if self.cat_mode == "native":
            for c in cat_cols:
                data[c] = _as_int_str(X[c])
        else:
            for c in cat_cols:
                vals = pd.to_numeric(X[c], errors="coerce").fillna(-1).astype(int).to_numpy()
                for v in self.categories_[c]:
                    data[f"{c}__{v}"] = (vals == v).astype(float)
        return pd.DataFrame(data, index=X.index)[self.feature_names_]

    # ------------------------------------------------------------------ cảnh báo giá trị lạ
    def unknown_values(self, X: pd.DataFrame) -> dict:
        """Giá trị chưa từng thấy lúc train (để cảnh báo, không để lặng lẽ dự đoán sai)."""
        res = {}
        ids = {i for v in X[self.issue_col] for i in parse_issue_ids(v)}
        if ids - set(self.issue_vocab_):
            res["issue_ids"] = sorted(ids - set(self.issue_vocab_))
        for c in self.cat_cols:
            vals = set(pd.to_numeric(X[c], errors="coerce").dropna().astype(int))
            if vals - set(self.categories_[c]):
                res[c] = sorted(vals - set(self.categories_[c]))
        return res
