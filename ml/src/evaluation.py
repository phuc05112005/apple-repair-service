"""Chỉ số đánh giá, baseline, trần nhiễu, kiểm định thống kê, khoảng dự báo conformal.
Mọi con số đưa vào báo cáo đều đi qua file này."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import r2_score

from src.features import CATALOG_COL, SERVICES_COL, issue_key, parse_issue_ids


# =====================================================================================================
# 1. Chỉ số hồi quy
# =====================================================================================================
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
    """Khoảng tin cậy bootstrap 95% (percentile) của MAE."""
    rng = np.random.default_rng(seed)
    abs_err = np.asarray(abs_err, float)
    idx = rng.integers(0, len(abs_err), size=(n, len(abs_err)))
    means = abs_err[idx].mean(axis=1)
    lo, hi = np.percentile(means, [2.5, 97.5])
    return float(lo), float(hi)


bootstrap_mean_ci = bootstrap_mae_ci   # cùng thuật toán, dùng cho mảng bất kỳ (vd. hiệu |e| giữa hai mô hình)


def paired_wilcoxon(abs_err_other, abs_err_best) -> dict:
    """Kiểm định Wilcoxon ghép cặp trên |e| của hai mô hình ở CÙNG các phiếu.
    delta = |e_other| - |e_best| > 0 nghĩa là mô hình tốt nhất sai ít hơn."""
    a, b = np.asarray(abs_err_other, float), np.asarray(abs_err_best, float)
    d = a - b
    try:
        p = float(stats.wilcoxon(a, b).pvalue)
    except ValueError:                     # mọi hiệu bằng 0
        p = 1.0
    return {"mean_delta": float(d.mean()), "pct_best_wins": float(np.mean(d > 0) * 100), "p_value": p}


# =====================================================================================================
# 2. Baseline (mốc mà mô hình ML phải vượt)
# =====================================================================================================
BASELINE_NAMES = [
    "B0 Trung bình",
    "B1 Định mức catalog",
    "B2 Tuyến tính theo catalog",
    "B3 Định mức x hệ số KTV",
    "B4 Bảng tra (thiết bị x lỗi x KTV)",
]


def baseline_predictions(train: pd.DataFrame, test: pd.DataFrame, target: str, issue_col: str) -> dict:
    """Học CHỈ từ `train`, dự đoán `test`. Năm mốc từ ngây thơ đến mạnh:
    B0 trung bình | B1 định mức catalog | B2 a*catalog+b | B3 catalog x hệ số tốc độ từng KTV | B4 bảng tra tổ hợp."""
    y = train[target].to_numpy(float)
    cat_tr, cat_te = train[CATALOG_COL].to_numpy(float), test[CATALOG_COL].to_numpy(float)

    # B2: hồi quy tuyến tính một biến (công thức đóng, không cần sklearn)
    slope, intercept = np.polyfit(cat_tr, y, 1) if np.ptp(cat_tr) > 0 else (0.0, y.mean())

    # B3: hệ số tốc độ mỗi KTV = trung bình tỉ lệ thực tế / định mức (học từ train)
    ratio = train.assign(_r=y / np.where(cat_tr > 0, cat_tr, np.nan)).groupby("technician_id")["_r"].mean()
    global_ratio = float(np.nanmean(y / np.where(cat_tr > 0, cat_tr, np.nan)))
    b3 = cat_te * test["technician_id"].map(ratio).fillna(global_ratio).to_numpy(float)

    # B4: bảng tra theo (thiết bị, tổ hợp lỗi, KTV) -> lùi dần (thiết bị, lỗi) -> lỗi -> trung bình chung
    tr_k = train[issue_col].map(issue_key)
    te_k = test[issue_col].map(issue_key)
    t = train.assign(_k=tr_k)
    full = t.groupby(["device_model_id", "_k", "technician_id"])[target].mean().to_dict()
    dev_issue = t.groupby(["device_model_id", "_k"])[target].mean().to_dict()
    by_issue = t.groupby("_k")[target].mean().to_dict()
    ymean = float(y.mean())
    b4 = np.array([
        full.get((d, k, tech), dev_issue.get((d, k), by_issue.get(k, ymean)))
        for d, k, tech in zip(test["device_model_id"], te_k, test["technician_id"])
    ], dtype=float)

    return {
        BASELINE_NAMES[0]: np.full(len(test), ymean),
        BASELINE_NAMES[1]: cat_te,
        BASELINE_NAMES[2]: slope * cat_te + intercept,
        BASELINE_NAMES[3]: b3,
        BASELINE_NAMES[4]: b4,
    }


# =====================================================================================================
# 3. Trần nhiễu ("pure error"): các phiếu có ĐẶC TRƯNG GIỐNG HỆT nhau chỉ khác nhau ở nhiễu
# =====================================================================================================
def twin_noise_floor(df: pd.DataFrame, target: str, issue_col: str) -> dict:
    """Ước lượng sai số bất khả giảm từ các phiếu "song sinh" (cùng thiết bị, tổ hợp lỗi, KTV, số dịch vụ, định mức).
    Với nhóm g có n_g >= 2 phiếu, phương sai nội nhóm không chệch là s_g^2 (ddof=1). Phương sai "pure error" gộp:
        sigma^2 = sum_g (n_g - 1) s_g^2 / sum_g (n_g - 1)
    => RMSE bất khả giảm ~ sigma. MAE bất khả giảm xấp xỉ bằng độ lệch tuyệt đối trung bình quanh trung bình nhóm,
    nhân sqrt(n_g/(n_g-1)) để bù việc trung bình nhóm được ước lượng từ chính các điểm đó.
    Mô hình có CV-RMSE/MAE thấp hơn rõ rệt các con số này là dấu hiệu đáng ngờ (rò rỉ, nhớ vẹt, dữ liệu trùng)."""
    key = (df["device_model_id"].astype(str) + "|" + df[issue_col].map(issue_key) + "|" +
           df["technician_id"].astype(str) + "|" + df[SERVICES_COL].astype(str) + "|" + df[CATALOG_COL].astype(str))
    ss, dof, mad_sum, rows = 0.0, 0, 0.0, 0
    for _, g in df.assign(_key=key).groupby("_key")[target]:
        a = g.to_numpy(float)
        n = len(a)
        if n < 2:
            continue
        ss += float(((a - a.mean()) ** 2).sum())
        dof += n - 1
        mad_sum += float(np.abs(a - a.mean()).sum()) * np.sqrt(n / (n - 1))
        rows += n
    if dof == 0:
        return {"noise_rmse_floor": float("nan"), "noise_mae_floor": float("nan"), "rows_covered": 0,
                "share_covered": 0.0, "n_groups_total": int(key.nunique())}
    return {"noise_rmse_floor": float(np.sqrt(ss / dof)), "noise_mae_floor": float(mad_sum / rows),
            "rows_covered": int(rows), "share_covered": float(rows / len(df)), "n_groups_total": int(key.nunique())}


# =====================================================================================================
# 4. Kiểm định tín hiệu KTV có hiệu chỉnh độ khó ca (ANCOVA bằng F-test từng phần trên log nhãn)
# =====================================================================================================
def _design(df: pd.DataFrame, with_tech: bool, issue_col: str):
    cols = [np.ones(len(df)), np.log(df[CATALOG_COL].to_numpy(float)), df[SERVICES_COL].to_numpy(float)]
    names = ["const", "log_catalog", "services"]
    for k in sorted({i for v in df[issue_col] for i in parse_issue_ids(v)}):
        cols.append(np.array([k in parse_issue_ids(v) for v in df[issue_col]], float)); names.append(f"issue_{k}")
    for d in sorted(df["device_model_id"].unique())[1:]:
        cols.append((df["device_model_id"].to_numpy() == d).astype(float)); names.append(f"device_{d}")
    if with_tech:
        for t in sorted(df["technician_id"].unique())[1:]:
            cols.append((df["technician_id"].to_numpy() == t).astype(float)); names.append(f"tech_{t}")
    return np.column_stack(cols), names


def technician_effect_test(df: pd.DataFrame, target: str, issue_col: str) -> dict:
    """Mô hình giảm:  log y ~ log(catalog) + số dịch vụ + mã lỗi + thiết bị
    Mô hình đầy đủ:   ... + KTV.   F-test từng phần: KTV có giải thích thêm biến thiên SAU KHI đã hiệu chỉnh độ khó ca?
    Trả về F, p, partial-eta^2 và hệ số tốc độ nhân của từng KTV (so với KTV tham chiếu, đã hiệu chỉnh)."""
    ok = df[(df[target] > 0) & (df[CATALOG_COL] > 0)]
    y = np.log(ok[target].to_numpy(float))
    X0, _ = _design(ok, False, issue_col)
    X1, names1 = _design(ok, True, issue_col)
    b0, *_ = np.linalg.lstsq(X0, y, rcond=None)
    b1, *_ = np.linalg.lstsq(X1, y, rcond=None)
    rss0, rss1 = float(np.sum((y - X0 @ b0) ** 2)), float(np.sum((y - X1 @ b1) ** 2))
    df_num = int(np.linalg.matrix_rank(X1) - np.linalg.matrix_rank(X0))
    df_den = int(len(y) - np.linalg.matrix_rank(X1))
    if df_num <= 0 or df_den <= 0 or rss1 <= 0:
        return {"F": float("nan"), "p_value": float("nan"), "partial_eta2": float("nan"), "factors": {}}
    F = ((rss0 - rss1) / df_num) / (rss1 / df_den)
    p = float(stats.f.sf(F, df_num, df_den))
    techs = sorted(ok["technician_id"].unique())
    coef = {int(techs[0]): 0.0}
    for t in techs[1:]:
        coef[int(t)] = float(b1[names1.index(f"tech_{t}")])
    gm = np.mean(list(coef.values()))                       # chuẩn hóa: trung bình nhân của các KTV = 1
    factors = {t: float(np.exp(c - gm)) for t, c in coef.items()}
    return {"F": float(F), "p_value": p, "partial_eta2": float((rss0 - rss1) / rss0),
            "df": (df_num, df_den), "factors": factors}


# =====================================================================================================
# 5. Khoảng dự báo conformal (split conformal trên phần dư out-of-fold)
# =====================================================================================================
def conformal_quantile(scores, coverage: float) -> float:
    """Phân vị bảo thủ ceil((n+1)*coverage)/n (hiệu chỉnh cỡ mẫu hữu hạn)."""
    s = np.asarray(scores, float)
    n = len(s)
    level = min(1.0, np.ceil((n + 1) * coverage) / n)
    return float(np.quantile(s, level, method="higher"))


def calibrate_interval(y_oof, pred_oof, coverage: float, min_minutes: float = 10.0) -> dict:
    """Chọn kiểu khoảng CHỈ dựa trên dữ liệu hiệu chuẩn (OOF của train), không nhìn test:
      - 'absolute': ŷ ± q          (độ rộng cố định)
      - 'relative': ŷ·(1 ± q_rel)  (độ rộng tỉ lệ với ŷ) — dùng khi |sai số| tăng theo ŷ (nhiễu nhân).
    Tiêu chí: tương quan Spearman(|r|, ŷ) > 0.15 và p < 0.01 -> relative."""
    y_oof, pred_oof = np.asarray(y_oof, float), np.maximum(np.asarray(pred_oof, float), min_minutes)
    r = np.abs(y_oof - pred_oof)
    rho, p = stats.spearmanr(r, pred_oof)
    q_abs = conformal_quantile(r, coverage)
    q_rel = conformal_quantile(r / pred_oof, coverage)
    method = "relative" if (rho > 0.15 and p < 0.01) else "absolute"
    return {"method": method, "q_abs": q_abs, "q_rel": q_rel, "spearman_rho": float(rho), "spearman_p": float(p)}


def interval_bounds(pred, interval: dict, min_minutes: float = 10.0):
    """(lower, upper) từ dự đoán và dict hiệu chuẩn (cùng logic với src/inference.py)."""
    pred = np.maximum(np.asarray(pred, float), min_minutes)
    half = pred * interval["q_rel"] if interval["method"] == "relative" else np.full_like(pred, interval["q_abs"])
    return np.maximum(pred - half, min_minutes), pred + half
