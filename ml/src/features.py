"""Làm sạch dữ liệu + tạo đặc trưng. Dùng CHUNG cho train và inference.
Class nằm trong module (không phải notebook/__main__) nên joblib nạp lại được ở mọi nơi."""
from __future__ import annotations

import numpy as np
import pandas as pd

SERVICES_COL = "total_services_count"
CATALOG_COL = "total_catalog_standard_duration_minutes"


def parse_issue_ids(value) -> list[int]:
    """'1, 6' -> [1, 6]. Chịu được None/NaN/khoảng trắng/dấu phẩy thừa."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return []
    return sorted({int(p) for p in str(value).replace(" ", "").split(",") if p.isdigit()})


def issue_key(value) -> str:
    return ",".join(map(str, parse_issue_ids(value)))


def clean_training_data(df: pd.DataFrame, target_col: str, group_col: str) -> tuple[pd.DataFrame, dict]:
    """Làm sạch tập train. Trả về (df sạch, báo cáo từng bước) để đưa vào báo cáo đồ án."""
    rep = {"rows_raw": int(len(df))}
    out = df.copy()
    if "is_reassigned" in out.columns:
        rep["dropped_reassigned"] = int((out["is_reassigned"] != 0).sum())
        out = out[out["is_reassigned"] == 0]
    before = len(out)
    out = out.dropna(subset=[target_col])
    out = out[(out[target_col] > 0) & (out[SERVICES_COL] > 0)]
    rep["dropped_invalid_target_or_no_service"] = int(before - len(out))
    before = len(out)
    out = out.drop_duplicates(subset=group_col, keep="first")
    rep["dropped_duplicate_tickets"] = int(before - len(out))
    rep["rows_clean"] = int(len(out))
    return out.reset_index(drop=True), rep


class RepairFeatureBuilder:
    """Biến bảng thô -> ma trận số / đặc trưng.
    Hỗ trợ 2 chế độ:
      - 'ohe': Mã hóa One-Hot đầy đủ cho các thuộc tính định danh (Ridge, Tree, RF, XGB, LGBM, CatBoost OHE).
      - 'native': Giữ dạng chuỗi định danh (CatBoost Native Categorical).
    """

    def __init__(self, num_cols, cat_cols, issue_col, cat_mode: str = "ohe"):
        self.num_cols = list(num_cols)
        self.cat_cols = list(cat_cols)
        self.issue_col = issue_col
        self.cat_mode = cat_mode

    def fit(self, df: pd.DataFrame):
        assert SERVICES_COL in self.num_cols and CATALOG_COL in self.num_cols
        self.issue_vocab_ = sorted({i for v in df[self.issue_col] for i in parse_issue_ids(v)})
        self.categories_ = {
            c: sorted(pd.to_numeric(df[c], errors="coerce").dropna().astype(int).unique().tolist())
            for c in self.cat_cols
        }
        if self.cat_mode == "native":
            self.feature_names_ = (
                self.num_cols + ["duration_per_service"]
                + [f"issue_{k}" for k in self.issue_vocab_]
                + self.cat_cols
            )
        else:
            self.feature_names_ = (
                self.num_cols + ["duration_per_service"]
                + [f"issue_{k}" for k in self.issue_vocab_]
                + [f"{c}__{v}" for c in self.cat_cols for v in self.categories_[c]]
            )
        return self

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)
        data = {c: pd.to_numeric(df[c], errors="coerce").fillna(0.0).to_numpy(float) for c in self.num_cols}
        cnt, cat = data[SERVICES_COL], data[CATALOG_COL]
        data["duration_per_service"] = np.divide(cat, cnt, out=np.zeros(n), where=cnt > 0)
        
        parsed = [set(parse_issue_ids(v)) for v in df[self.issue_col]]
        for k in self.issue_vocab_:
            data[f"issue_{k}"] = np.array([k in s for s in parsed], dtype=float)
            
        if self.cat_mode == "native":
            for c in self.cat_cols:
                data[c] = df[c].astype(str).to_numpy()
        else:
            for c in self.cat_cols:
                vals = pd.to_numeric(df[c], errors="coerce").fillna(-1).astype(int).to_numpy()
                for v in self.categories_[c]:
                    data[f"{c}__{v}"] = (vals == v).astype(float)
                    
        return pd.DataFrame(data, index=df.index)[self.feature_names_]

    def unknown_values(self, df: pd.DataFrame) -> dict:
        """Giá trị chưa từng thấy lúc train (để cảnh báo, không để lặng lẽ dự đoán sai)."""
        res = {}
        ids = {i for v in df[self.issue_col] for i in parse_issue_ids(v)}
        if ids - set(self.issue_vocab_):
            res["issue_ids"] = sorted(ids - set(self.issue_vocab_))
        for c in self.cat_cols:
            vals = set(pd.to_numeric(df[c], errors="coerce").dropna().astype(int))
            if vals - set(self.categories_[c]):
                res[c] = sorted(vals - set(self.categories_[c]))
        return res