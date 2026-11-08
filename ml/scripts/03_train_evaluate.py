"""Bước 3: huấn luyện + chọn mô hình + đánh giá + đóng gói, KHÔNG đồ thị (bản dòng lệnh của notebook).
Dùng ĐÚNG các hàm trong src/ và cùng seed với notebook => cùng kết quả, cùng bundle.
Quy trình: làm sạch -> tách test theo phiếu -> baseline (CV) -> nested CV mọi mô hình -> chọn theo CV-MAE
-> đánh giá test một lần -> khoảng dự báo conformal -> refit toàn bộ -> lưu 1 bundle."""
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

from config.config import (BUNDLE_PATH, CV_FOLDS, FEATURE_COLS, GROUP_COL, INNER_CV_FOLDS, INTERVAL_COVERAGE, ISSUE_COL,
                           MAX_PLAUSIBLE_MINUTES, MIN_PREDICTED_MINUTES, QUICK_MODE, RANDOM_STATE, RAW_DATA_PATH,
                           REPORTS_DIR, SPLIT_MODE, SYNTHETIC_DATA, TARGET_COL)
from src.bundle import base_versions, fit_final_pipeline, new_version_tag, package_bundle, reload_check
from src.evaluation import (baseline_predictions, bootstrap_mae_ci, calibrate_interval, interval_bounds,
                            regression_report, twin_noise_floor)
from src.features import clean_training_data
from src.modeling import (cv_baselines, fit_deployable, leaderboard_row, make_candidates, make_group_folds, nested_cv,
                          split_train_test)


def main():
    if QUICK_MODE:
        print("CẢNH BÁO: QUICK_MODE=True (lưới rút gọn) - không dùng kết quả này cho báo cáo.")
    df, clean_rep = clean_training_data(pd.read_csv(RAW_DATA_PATH), TARGET_COL, GROUP_COL, MAX_PLAUSIBLE_MINUTES)
    print(f"1. Làm sạch: {clean_rep}")
    train, test = split_train_test(df)
    y_tr, y_te = train[TARGET_COL].to_numpy(float), test[TARGET_COL].to_numpy(float)
    assert set(train[GROUP_COL]).isdisjoint(test[GROUP_COL])
    print(f"2. Tách theo phiếu ({SPLIT_MODE}): train={len(train)} | test={len(test)}")
    folds = make_group_folds(train[GROUP_COL], CV_FOLDS, RANDOM_STATE)

    rows = {n: leaderboard_row(n, "baseline", o, y_tr, folds) for n, o in cv_baselines(train, TARGET_COL, ISSUE_COL, folds, y_tr).items()}
    primary = min(rows, key=lambda n: rows[n]["cv_mae"])
    noise = twin_noise_floor(train, TARGET_COL, ISSUE_COL)
    print(f"3. Baseline mạnh nhất theo CV: {primary} ({rows[primary]['cv_mae']:.3f}) | trần nhiễu MAE ~ {noise['noise_mae_floor']:.2f}")

    cands, nested, deploy = make_candidates(), {}, {}
    print(f"4. Nested CV {CV_FOLDS}x{INNER_CV_FOLDS} cho {len(cands)} mô hình...")
    for name, spec in cands.items():
        t0 = time.time()
        nested[name] = nested_cv(spec, train, y_tr, folds, INNER_CV_FOLDS, RANDOM_STATE)
        deploy[name] = fit_deployable(spec, train, y_tr, CV_FOLDS, RANDOM_STATE)
        rows[name] = leaderboard_row(name, "model", nested[name].oof_pred, y_tr, folds,
                                     best_params={k.split("__", 1)[1]: v for k, v in deploy[name][1].items()})
        print(f"   {name:24s} CV-MAE = {rows[name]['cv_mae']:.3f} ± {rows[name]['cv_se']:.3f} ({time.time() - t0:.0f}s)", flush=True)

    cv_df = pd.DataFrame(rows.values()).sort_values("cv_mae").reset_index(drop=True)
    models = cv_df[cv_df["kind"] == "model"].reset_index(drop=True)
    best = models.loc[0, "name"]
    b = models.loc[0]
    tie = models[models["cv_mae"] <= b["cv_mae"] + b["cv_se"]]["name"].tolist()
    print(f"5. CHỌN: {best} | CV-MAE {b['cv_mae']:.3f} ± {b['cv_se']:.3f} | nhóm hòa: {tie}")
    if b["cv_mae"] > rows[primary]["cv_mae"] - rows[primary]["cv_se"]:
        print("   CẢNH BÁO: không hơn baseline mạnh nhất quá 1 SE.")

    floor = lambda p: np.maximum(np.asarray(p, float), MIN_PREDICTED_MINUTES)
    test_pred = {n: floor(deploy[n][0].predict(test[FEATURE_COLS])) for n in cands}
    test_pred.update({n: floor(p) for n, p in baseline_predictions(train, test, TARGET_COL, ISSUE_COL).items()})
    res = []
    for n, p in test_pred.items():
        lo, hi = bootstrap_mae_ci(np.abs(p - y_te))
        res.append({"name": n, **regression_report(y_te, p), "CI_lo": lo, "CI_hi": hi})
    test_res = pd.DataFrame(res).sort_values("MAE").reset_index(drop=True)
    print(f"\n6. TEST ({len(test)} phiếu)\n{test_res.round(3).to_string(index=False)}")
    bt, pt = test_res[test_res.name == best].iloc[0], test_res[test_res.name == primary].iloc[0]

    iv = calibrate_interval(y_tr, nested[best].oof_pred, INTERVAL_COVERAGE, MIN_PREDICTED_MINUTES)
    lo, hi = interval_bounds(test_pred[best], iv, MIN_PREDICTED_MINUTES)
    cov = float(np.mean((y_te >= lo) & (y_te <= hi)))
    print(f"7. Khoảng dự báo {INTERVAL_COVERAGE:.0%} kiểu '{iv['method']}': độ phủ test = {cov:.1%}")

    spec = cands[best]
    final = fit_final_pipeline(spec, deploy[best][1], df)
    keys = ("MAE", "RMSE", "R2", "P90_abs_err", "within_5min_pct", "bias")
    md = {
        "model_name": best, "model_version": new_version_tag(), "trained_at": pd.Timestamp.now().isoformat(timespec="seconds"),
        "synthetic_data": SYNTHETIC_DATA, "use_augmentation": False, "best_params": rows[best]["best_params"],
        "n_train_rows_final": int(len(df)), "n_test_rows_eval": int(len(test)),
        "test_metrics": {k: float(bt[k]) for k in keys}, "test_mae_ci95": [float(bt.CI_lo), float(bt.CI_hi)],
        "baseline_primary_name": primary, "baseline_primary_test_metrics": {k: float(pt[k]) for k in keys},
        "selection": {"rule": "CV-MAE nhỏ nhất theo nested CV", "cv_mae": float(b["cv_mae"]), "cv_se": float(b["cv_se"]),
                      "statistical_tie_set": tie, "primary_baseline_cv_mae": float(rows[primary]["cv_mae"]),
                      "outer_folds": CV_FOLDS, "inner_folds": INNER_CV_FOLDS},
        "noise_floor": {k: float(v) for k, v in noise.items()},
        "interval_coverage": INTERVAL_COVERAGE, "interval_method": iv["method"], "interval_q_abs": float(iv["q_abs"]),
        "interval_q_rel": float(iv["q_rel"]), "interval_halfwidth_minutes": float(np.median((hi - lo) / 2)),
        "interval_test_coverage": cov, "split_mode": SPLIT_MODE, "cleaning": clean_rep,
        "features": list(final.named_steps["fe"].feature_names_),
        "technician_ids": [int(t) for t in final.named_steps["fe"].categories_["technician_id"]], "versions": base_versions(),
    }
    package_bundle(BUNDLE_PATH, final, md)
    (REPORTS_DIR / "metrics.json").write_text(json.dumps(md, ensure_ascii=False, indent=2, default=float), encoding="utf-8")
    cv_df.drop(columns=["fold_maes"]).to_csv(REPORTS_DIR / "cv_leaderboard.csv", index=False)
    test_res.to_csv(REPORTS_DIR / "test_comparison.csv", index=False)
    reload_check(BUNDLE_PATH, final, df)
    print(f"\n8. [XONG] Bundle: {BUNDLE_PATH} (đã kiểm tra nạp lại)")


if __name__ == "__main__":
    main()
