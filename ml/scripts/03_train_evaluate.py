"""Bước 3: huấn luyện + đánh giá + đóng gói. Quy trình:
 làm sạch -> tách test (theo phiếu) -> baseline -> CV theo nhóm chọn tham số -> khoảng dự báo (OOF)
 -> đánh giá test -> phân tích sai số / KTV -> refit toàn bộ dữ liệu -> lưu 1 bundle."""
import itertools
import json
import platform
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from config.config import (AUGMENT_TARGET_ROWS, BUNDLE_PATH, CV_FOLDS, GROUP_COL, INTERVAL_COVERAGE, ISSUE_COL,
                           MODEL_NAME, RANDOM_STATE, RAW_DATA_PATH, REPORTS_DIR, SPLIT_MODE, SYNTHETIC_DATA,
                           TARGET_COL, TEST_SIZE, TIME_COL, USE_AUGMENTATION, XGB_GRID)
from src.evaluation import baseline_predictions, bootstrap_mae_ci, regression_report
from src.features import clean_training_data, issue_key
from src.inference import save_bundle
from src.modeling import fit_model, fit_predict


def split_train_test(df: pd.DataFrame):
    if SPLIT_MODE == "time" and TIME_COL in df.columns:
        d = df.assign(_t=pd.to_datetime(df[TIME_COL], errors="coerce")).sort_values(["_t", GROUP_COL])
        cut = int(len(d) * (1 - TEST_SIZE))
        return d.iloc[:cut].drop(columns="_t").reset_index(drop=True), d.iloc[cut:].drop(columns="_t").reset_index(drop=True)
    tr, te = next(GroupShuffleSplit(1, test_size=TEST_SIZE, random_state=RANDOM_STATE).split(df, groups=df[GROUP_COL]))
    return df.iloc[tr].reset_index(drop=True), df.iloc[te].reset_index(drop=True)


def cv_search(train: pd.DataFrame):
    """CV theo nhóm (phiếu). Chọn cấu hình ĐƠN GIẢN NHẤT trong số các cấu hình hơn kém nhau <1% MAE."""
    keys = list(XGB_GRID)
    rows, oof_store = [], {}
    gkf = GroupKFold(n_splits=CV_FOLDS)
    y = train[TARGET_COL].to_numpy(float)
    for combo in itertools.product(*[XGB_GRID[k] for k in keys]):
        params = dict(zip(keys, combo))
        oof, maes = np.zeros(len(train)), []
        for a, b in gkf.split(train, groups=train[GROUP_COL]):
            oof[b] = fit_predict(train.iloc[a], train.iloc[b], params, USE_AUGMENTATION, AUGMENT_TARGET_ROWS)
            maes.append(np.mean(np.abs(oof[b] - y[b])))
        rows.append({**params, "cv_MAE": np.mean(maes), "cv_MAE_std": np.std(maes)})
        oof_store[tuple(combo)] = oof
    table = pd.DataFrame(rows).sort_values("cv_MAE").reset_index(drop=True)
    near = table[table["cv_MAE"] <= table["cv_MAE"].iloc[0] * 1.01].sort_values(["max_depth", "n_estimators"])
    best = {k: (int(v) if k != "learning_rate" else float(v)) for k, v in near.iloc[0][keys].items()}
    return best, table, oof_store[tuple(best[k] for k in keys)]


def technician_effect(builder, model, train: pd.DataFrame) -> pd.DataFrame:
    """Giữ nguyên phiếu, chỉ đổi KTV: mô hình có thật sự phân biệt KTV không?"""
    techs = builder.categories_["technician_id"]
    counts = train.groupby([ISSUE_COL, "device_model_id"]).size().rename("n").reset_index().nlargest(30, "n")
    prof = train.drop_duplicates([ISSUE_COL, "device_model_id"]).merge(counts[[ISSUE_COL, "device_model_id"]], on=[ISSUE_COL, "device_model_id"])
    mean_pred = {}
    for t in techs:
        tmp = prof.copy()
        tmp["technician_id"] = t
        mean_pred[t] = float(model.predict(builder.transform(tmp)).mean())
    out = pd.DataFrame({"technician_id": list(mean_pred), "mean_pred_minutes": list(mean_pred.values())})
    out["model_speed_index"] = (out["mean_pred_minutes"] / out["mean_pred_minutes"].mean()).round(3)
    return out


def make_plots(y_true, y_pred, model, feature_names):
    fig, ax = plt.subplots(1, 3, figsize=(17, 4.6))
    ax[0].scatter(y_true, y_pred, s=10, alpha=0.5)
    lim = [min(y_true.min(), y_pred.min()), max(y_true.max(), y_pred.max())]
    ax[0].plot(lim, lim, "r--")
    ax[0].set(xlabel="Thực tế (phút)", ylabel="Dự đoán (phút)", title="Dự đoán vs thực tế (tập test)")
    ax[1].hist(y_pred - y_true, bins=30, color="#2b5c8f")
    ax[1].set(xlabel="Sai số = dự đoán - thực tế (phút)", title="Phân phối sai số")
    imp = pd.Series(getattr(model, "feature_importances_", np.zeros(len(feature_names))), index=feature_names).nlargest(12)
    ax[2].barh(imp.index[::-1], imp.values[::-1], color="#2b5c8f")
    ax[2].set(title="Top 12 đặc trưng quan trọng")
    plt.tight_layout()
    fig.savefig(REPORTS_DIR / "model_diagnostics.png", dpi=130)
    plt.close(fig)


def main():
    df_raw = pd.read_csv(RAW_DATA_PATH)
    df, clean_rep = clean_training_data(df_raw, TARGET_COL, GROUP_COL)
    print(f"1. Làm sạch: {clean_rep}")
    train, test = split_train_test(df)
    print(f"2. Tách theo phiếu ({SPLIT_MODE}): train={len(train)} | test={len(test)} (không phiếu nào ở cả hai tập)")
    y_te = test[TARGET_COL].to_numpy(float)

    # ---- Baseline
    print("\n3. BASELINE trên tập test")
    results = {}
    for name, p in baseline_predictions(train, test, TARGET_COL, ISSUE_COL).items():
        results[name] = (regression_report(y_te, p), np.abs(p - y_te))

    # ---- CV chọn tham số
    print(f"4. CV {CV_FOLDS}-fold theo phiếu, {np.prod([len(v) for v in XGB_GRID.values()])} cấu hình...")
    best, cv_table, oof = cv_search(train)
    cv_table.to_csv(REPORTS_DIR / "cv_results.csv", index=False)
    print(cv_table.head(5).round(3).to_string(index=False))
    print(f"   -> chọn (đơn giản nhất trong nhóm hơn kém <1%): {best}")
    q = float(np.quantile(np.abs(train[TARGET_COL].to_numpy(float) - oof), INTERVAL_COVERAGE))

    # ---- Đánh giá test
    builder, model = fit_model(train, best, USE_AUGMENTATION, AUGMENT_TARGET_ROWS)
    pred = np.maximum(model.predict(builder.transform(test)), 0)
    results[f"{MODEL_NAME} (đề xuất)"] = (regression_report(y_te, pred), np.abs(pred - y_te))
    coverage = float(np.mean(np.abs(pred - y_te) <= q))

    table = pd.DataFrame([{"Mô hình": k, **{m: round(v, 3) for m, v in r.items()},
                           "MAE 95% CI": "{:.2f}–{:.2f}".format(*bootstrap_mae_ci(e))} for k, (r, e) in results.items()])
    table.to_csv(REPORTS_DIR / "test_comparison.csv", index=False)
    print(f"\n5. SO SÁNH TRÊN {len(test)} PHIẾU TEST\n{table.to_string(index=False)}")
    print(f"\n   Khoảng dự báo {INTERVAL_COVERAGE:.0%}: ±{q:.1f} phút | độ phủ thực trên test = {coverage:.1%}")

    # ---- Phân tích sai số
    diag = test[[GROUP_COL, ISSUE_COL, "device_model_id", "technician_id"]].copy()
    diag["actual"], diag["pred"] = y_te, pred.round(1)
    diag["abs_err"] = np.abs(diag["pred"] - diag["actual"]).round(1)
    diag.nlargest(15, "abs_err").to_csv(REPORTS_DIR / "top_errors.csv", index=False)
    per_tech = diag.groupby("technician_id")["abs_err"].agg(["count", "mean"]).round(2)
    print(f"\n6. MAE theo KTV:\n{per_tech.to_string()}")
    mae, rmse = results[f"{MODEL_NAME} (đề xuất)"][0]["MAE"], results[f"{MODEL_NAME} (đề xuất)"][0]["RMSE"]
    print(f"   MAE/RMSE = {mae / rmse:.2f} (≈0.80 nếu sai số Gauss; thấp hơn nhiều = có vài ca lệch rất lớn, xem reports/top_errors.csv)")
    tech_eff = technician_effect(builder, model, train)
    tech_eff.to_csv(REPORTS_DIR / "technician_effect.csv", index=False)
    print(f"\n7. HIỆU ỨNG KTV mà mô hình học được (cùng phiếu, đổi KTV):\n{tech_eff.to_string(index=False)}")
    make_plots(y_te, pred, model, builder.feature_names_)

    # ---- Refit toàn bộ dữ liệu sạch -> sản phẩm
    builder_f, model_f = fit_model(df, best, USE_AUGMENTATION, AUGMENT_TARGET_ROWS)
    import xgboost
    metadata = {
        "model_name": MODEL_NAME, "model_version": f"v2-{datetime.now():%Y%m%d}",
        "trained_at": datetime.now().isoformat(timespec="seconds"),
        "synthetic_data": SYNTHETIC_DATA, "use_augmentation": USE_AUGMENTATION,
        "best_params": best, "n_train_rows_final": int(len(df)), "n_test_rows_eval": int(len(test)),
        "test_metrics": results[f"{MODEL_NAME} (đề xuất)"][0],
        "baseline_B3_test_metrics": results["B3 Bảng tra (lỗi x KTV)"][0],
        "interval_coverage": INTERVAL_COVERAGE, "interval_halfwidth_minutes": q, "interval_test_coverage": coverage,
        "split_mode": SPLIT_MODE, "cleaning": clean_rep, "features": builder_f.feature_names_,
        "technician_ids": builder_f.categories_["technician_id"],
        "versions": {"python": platform.python_version(), "sklearn": sklearn.__version__,
                     "pandas": pd.__version__, "xgboost": xgboost.__version__},
    }
    save_bundle(BUNDLE_PATH, builder_f, model_f, metadata)
    (REPORTS_DIR / "metrics.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2, default=float), encoding="utf-8")
    print(f"\n8. [XONG] Bundle: {BUNDLE_PATH}\n   Báo cáo: {REPORTS_DIR}")


if __name__ == "__main__":
    main()
