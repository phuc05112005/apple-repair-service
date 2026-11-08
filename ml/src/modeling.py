"""Mô hình ứng viên, chia fold, nested cross-validation, tinh chỉnh, đóng gói bundle.
Notebook và scripts/03_train_evaluate.py cùng gọi các hàm ở đây => kết quả hai nơi LUÔN giống nhau.

Mọi mô hình là một sklearn Pipeline([("fe", RepairFeatureBuilder), ("est", bộ ước lượng)]) nhận BẢNG THÔ
(5 cột gốc). Nhờ vậy bộ mã hóa đặc trưng được fit lại trong từng fold của CV (không rò rỉ)."""
from __future__ import annotations

import itertools
import time
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.compose import TransformedTargetRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import GridSearchCV, GroupShuffleSplit
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeRegressor

from config.config import (CAT_COLS, FEATURE_COLS, GROUP_COL, INNER_CV_FOLDS, ISSUE_COL, N_JOBS, NUM_COLS,
                           QUICK_MODE, RANDOM_STATE, SPLIT_MODE, TEST_SIZE, TIME_COL)
from src.evaluation import baseline_predictions, regression_report
from src.features import RepairFeatureBuilder


# =====================================================================================================
# 1. Chia dữ liệu
# =====================================================================================================
def split_train_test(frame: pd.DataFrame, seed: int = RANDOM_STATE) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Tách train/test THEO PHIẾU. 'group': ngẫu nhiên theo ticket_id; 'time': 20% phiếu mới nhất làm test.
    Thứ tự dòng của train được xáo một lần (cố định seed) để fold không phụ thuộc thứ tự bản ghi trong DB."""
    if SPLIT_MODE == "time" and TIME_COL in frame.columns:
        d = frame.assign(_t=pd.to_datetime(frame[TIME_COL], errors="coerce")).sort_values(["_t", GROUP_COL])
        cut = int(len(d) * (1 - TEST_SIZE))
        train, test = d.iloc[:cut].drop(columns="_t"), d.iloc[cut:].drop(columns="_t")
    else:
        gss = GroupShuffleSplit(n_splits=1, test_size=TEST_SIZE, random_state=seed)
        tr, te = next(gss.split(frame, groups=frame[GROUP_COL]))
        train, test = frame.iloc[tr], frame.iloc[te]
    train = train.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    return train, test.reset_index(drop=True)


def make_group_folds(groups, k: int, seed: int = RANDOM_STATE) -> list[tuple[np.ndarray, np.ndarray]]:
    """K-fold theo nhóm: xáo các nhóm duy nhất (cố định seed) rồi gán fold = vị trí mod k.
    Đảm bảo (i) một nhóm chỉ ở một fold, (ii) fold cân bằng, (iii) không phụ thuộc thứ tự dòng/phiên bản sklearn."""
    groups = np.asarray(groups)
    uniq = np.unique(groups)
    rng = np.random.default_rng(seed)
    rng.shuffle(uniq)
    fold_of = {g: i % k for i, g in enumerate(uniq)}
    assign = np.array([fold_of[g] for g in groups])
    return [(np.where(assign != f)[0], np.where(assign == f)[0]) for f in range(k)]


# =====================================================================================================
# 2. Mô hình ứng viên + lưới tham số
# =====================================================================================================
@dataclass
class Spec:
    name: str
    est: object                 # bộ ước lượng (nhận ma trận đặc trưng)
    grid: dict                  # lưới tham số, khóa dạng 'est__...' (tiền tố của Pipeline)
    mode: str = "ohe"           # chế độ mã hóa của builder
    family: str = ""            # mô tả ngắn họ mô hình
    notes: str = ""


def _quick(grid: dict) -> dict:
    return {k: v[:2] for k, v in grid.items()} if QUICK_MODE else grid


def make_candidates(seed: int = RANDOM_STATE) -> dict[str, Spec]:
    """Bảy mô hình đại diện cho các giả định khác nhau về dữ liệu. XGBoost/LightGBM/CatBoost chỉ được thêm
    nếu đã cài. Các mô hình tăng cường cây cho phép chọn hàm mất mát bình phương HOẶC tuyệt đối (khớp KPI = MAE)."""
    C: dict[str, Spec] = {}

    C["Ridge (tuyến tính)"] = Spec(
        "Ridge (tuyến tính)", make_pipeline(StandardScaler(), Ridge()),
        _quick({"est__ridge__alpha": [0.1, 1.0, 10.0, 100.0]}), "ohe",
        "tuyến tính, y thô", "cộng tính, không có tương tác")
    C["Ridge (log-nhân)"] = Spec(
        "Ridge (log-nhân)",
        TransformedTargetRegressor(regressor=make_pipeline(StandardScaler(), Ridge()), func=np.log, inverse_func=np.exp),
        _quick({"est__regressor__ridge__alpha": [0.1, 1.0, 10.0, 100.0]}), "ohe",
        "tuyến tính trên log y = mô hình NHÂN", "log y = a + b·log(catalog) + hệ số KTV ⇒ y = catalog^b × tốc độ KTV")
    C["Decision Tree"] = Spec(
        "Decision Tree", DecisionTreeRegressor(random_state=seed),
        _quick({"est__max_depth": [3, 5, 8, None], "est__min_samples_leaf": [1, 5, 20]}), "ohe",
        "một cây", "chia vùng, dễ diễn giải")
    C["Random Forest"] = Spec(
        "Random Forest", RandomForestRegressor(n_estimators=300, random_state=seed, n_jobs=N_JOBS),
        _quick({"est__max_depth": [None, 6, 10], "est__min_samples_leaf": [1, 3, 5]}), "ohe",
        "bagging", "trung bình nhiều cây độc lập, giảm phương sai")

    try:
        import xgboost
        from xgboost import XGBRegressor
        ver = tuple(int(p) for p in xgboost.__version__.split(".")[:2] if p.isdigit())
        objs = ["reg:squarederror", "reg:absoluteerror"] if ver >= (1, 7) else ["reg:squarederror"]
        C["XGBoost"] = Spec(
            "XGBoost", XGBRegressor(random_state=seed, n_jobs=N_JOBS, verbosity=0),
            _quick({"est__max_depth": [2, 3, 4, 6], "est__learning_rate": [0.03, 0.08],
                    "est__n_estimators": [200, 400], "est__objective": objs}), "ohe",
            "boosting", "cây nối tiếp sửa lỗi, có điều chuẩn")
    except ImportError:
        pass
    try:
        from lightgbm import LGBMRegressor
        C["LightGBM"] = Spec(
            "LightGBM", LGBMRegressor(random_state=seed, n_jobs=N_JOBS, verbose=-1),
            _quick({"est__num_leaves": [7, 15, 31], "est__learning_rate": [0.03, 0.08],
                    "est__n_estimators": [200, 400], "est__objective": ["regression", "regression_l1"]}), "ohe",
            "boosting (leaf-wise, histogram)", "nhanh, dễ quá khớp khi ít dữ liệu")
    except ImportError:
        pass
    try:
        from catboost import CatBoostRegressor
        C["CatBoost (native cat)"] = Spec(
            "CatBoost (native cat)",
            CatBoostRegressor(random_seed=seed, verbose=0, thread_count=N_JOBS if N_JOBS > 0 else None,
                              allow_writing_files=False, cat_features=list(CAT_COLS)),
            _quick({"est__depth": [4, 6], "est__learning_rate": [0.05, 0.1],
                    "est__iterations": [300], "est__loss_function": ["RMSE", "MAE"]}), "native",
            "boosting (cây đối xứng)", "tự mã hóa biến định danh (ordered target statistics)")
    except ImportError:
        pass
    return C


def build_pipeline(spec: Spec) -> Pipeline:
    """Pipeline(bảng thô -> đặc trưng -> mô hình). Builder fit lại trong mỗi lần fit của pipeline."""
    fe = RepairFeatureBuilder(NUM_COLS, CAT_COLS, ISSUE_COL, cat_mode=spec.mode)
    return Pipeline([("fe", fe), ("est", clone(spec.est))])


def n_configs(grid: dict) -> int:
    return int(np.prod([len(v) for v in grid.values()])) if grid else 1


def _search(spec: Spec, X: pd.DataFrame, y: np.ndarray, groups: np.ndarray, k: int, seed: int) -> GridSearchCV:
    folds = make_group_folds(groups, k, seed)
    gs = GridSearchCV(build_pipeline(spec), spec.grid, cv=folds, scoring="neg_mean_absolute_error",
                      refit=True, n_jobs=1, error_score="raise")
    return gs.fit(X, y)


# =====================================================================================================
# 3. Nested cross-validation (ước lượng KHÔNG thiên lệch cho cả bước tinh chỉnh)
# =====================================================================================================
@dataclass
class NestedResult:
    name: str
    oof_pred: np.ndarray
    fold_maes: np.ndarray
    chosen_params: list = field(default_factory=list)
    seconds: float = 0.0


def nested_cv(spec: Spec, train: pd.DataFrame, y: np.ndarray, outer_folds, inner_k: int = INNER_CV_FOLDS,
              seed: int = RANDOM_STATE) -> NestedResult:
    """Vòng NGOÀI (outer): K fold để ĐÁNH GIÁ. Với mỗi fold ngoài, vòng TRONG (inner): GridSearchCV chỉ trên phần
    train của fold đó để chọn siêu tham số, rồi dự đoán fold ngoài. Fold ngoài không bao giờ tham gia chọn tham số
    => MAE không bị lạc quan, và dự đoán out-of-fold (OOF) dùng được để hiệu chuẩn khoảng dự báo."""
    t0 = time.time()
    X = train[FEATURE_COLS]
    groups = train[GROUP_COL].to_numpy()
    oof, maes, chosen = np.zeros(len(train)), [], []
    for f, (tr, va) in enumerate(outer_folds):
        gs = _search(spec, X.iloc[tr], y[tr], groups[tr], inner_k, seed + f)
        oof[va] = gs.predict(X.iloc[va])
        maes.append(float(np.mean(np.abs(oof[va] - y[va]))))
        chosen.append(gs.best_params_)
    return NestedResult(spec.name, oof, np.array(maes), chosen, time.time() - t0)


def fit_deployable(spec: Spec, train: pd.DataFrame, y: np.ndarray, k: int, seed: int = RANDOM_STATE):
    """Chọn siêu tham số trên TOÀN BỘ train (k fold) và refit -> (pipeline đã fit, tham số tốt nhất, CV-MAE chọn tham số)."""
    gs = _search(spec, train[FEATURE_COLS], y, train[GROUP_COL].to_numpy(), k, seed)
    return gs.best_estimator_, gs.best_params_, float(-gs.best_score_)


def cv_baselines(train: pd.DataFrame, target: str, issue_col: str, outer_folds, y: np.ndarray) -> dict[str, np.ndarray]:
    """OOF của baseline: mỗi fold, baseline được học lại chỉ từ phần train của fold."""
    oof: dict[str, np.ndarray] = {}
    for tr, va in outer_folds:
        preds = baseline_predictions(train.iloc[tr], train.iloc[va], target, issue_col)
        for name, p in preds.items():
            oof.setdefault(name, np.zeros(len(train)))[va] = p
    return oof


def leaderboard_row(name: str, kind: str, oof: np.ndarray, y: np.ndarray, folds, **extra) -> dict:
    """Một dòng bảng xếp hạng CV: MAE từng fold, trung bình, độ lệch chuẩn (ddof=1), sai số chuẩn SE = s/sqrt(K)."""
    fold_maes = np.array([np.mean(np.abs(oof[va] - y[va])) for _, va in folds])
    rep = regression_report(y, oof)
    s = float(fold_maes.std(ddof=1))
    return {"name": name, "kind": kind, "cv_mae": float(fold_maes.mean()), "cv_std": s,
            "cv_se": s / np.sqrt(len(fold_maes)), "cv_rmse": rep["RMSE"], "cv_r2": rep["R2"],
            "fold_maes": fold_maes.tolist(), **extra}
