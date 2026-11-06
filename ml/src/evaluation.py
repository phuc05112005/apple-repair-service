"""Chỉ số đánh giá, baseline, khoảng tin cậy. Mọi con số đưa vào báo cáo đều đi qua đây."""
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

from src.features import CATALOG_COL, issue_key


def regression_report(y_true, y_pred) -> dict:
    y_true, y_pred = np.asarray(y_true, float), np.asarray(y_pred, float)
    err = y_pred - y_true
    return {
        "MAE": float(np.mean(np.abs(err))),
        "RMSE": float(np.sqrt(np.mean(err ** 2))),
        "R2": float(r2_score(y_true, y_pred)),
        "P90_abs_err": float(np.quantile(np.abs(err), 0.9)),
        "within_5min_pct": float(np.mean(np.abs(err) <= 5) * 100),
        "bias": float(err.mean()),
    }


def bootstrap_mae_ci(abs_err, n: int = 2000, seed: int = 0) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    abs_err = np.asarray(abs_err, float)
    means = [rng.choice(abs_err, len(abs_err)).mean() for _ in range(n)]
    lo, hi = np.percentile(means, [2.5, 97.5])
    return float(lo), float(hi)


def baseline_predictions(train: pd.DataFrame, test: pd.DataFrame, target: str, issue_col: str) -> dict:
    """Các mốc phải vượt qua. Nếu mô hình không hơn rõ rệt B3 thì phải nói thẳng."""
    y = train[target]
    lin = LinearRegression().fit(train[[CATALOG_COL]], y)
    tr_k = train[issue_col].map(issue_key)
    te_k = test[issue_col].map(issue_key)
    full = train.assign(_k=tr_k).groupby(["_k", "technician_id"])[target].mean().to_dict()
    by_issue = train.assign(_k=tr_k).groupby("_k")[target].mean().to_dict()
    return {
        "B0 Trung bình": np.full(len(test), y.mean()),
        "B1 Định mức catalog": test[CATALOG_COL].to_numpy(float),
        "B2 Tuyến tính theo catalog": lin.predict(test[[CATALOG_COL]]),
        "B3 Bảng tra (lỗi x KTV)": np.array(
            [full.get((k, t), by_issue.get(k, y.mean())) for k, t in zip(te_k, test["technician_id"])]
        ),
    }
