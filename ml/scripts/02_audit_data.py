"""Bước 2: KIỂM TRA DỮ LIỆU trước khi huấn luyện. Kết quả lưu reports/data_audit.json (đưa thẳng vào báo cáo).
Trả lời: dữ liệu có sạch không? có tín hiệu KTV không? có đủ đa dạng không?"""
import json
import sys
from pathlib import Path

import pandas as pd
from scipy import stats

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

from config.config import GROUP_COL, ISSUE_COL, RAW_DATA_PATH, REPORTS_DIR, TARGET_COL
from src.features import CATALOG_COL, clean_training_data, issue_key


def main():
    df_raw = pd.read_csv(RAW_DATA_PATH)
    df, rep = clean_training_data(df_raw, TARGET_COL, GROUP_COL)
    audit = {"cleaning": rep}
    print("=== LÀM SẠCH ===")
    for k, v in rep.items():
        print(f"  {k}: {v}")

    # Tín hiệu KTV: tỉ lệ thực tế / định mức, ca 1 dịch vụ
    single = df[df["total_services_count"] == 1].copy()
    single["ratio"] = single[TARGET_COL] / single[CATALOG_COL]
    by_tech = single.groupby("technician_id")["ratio"].agg(["count", "mean", "std"]).round(3)
    print("\n=== TỈ LỆ THỰC TẾ / ĐỊNH MỨC THEO KTV (ca 1 dịch vụ) ===")
    print(by_tech.to_string())
    groups = [g["ratio"].to_numpy() for _, g in single.groupby("technician_id") if len(g) > 1]
    p = float(stats.f_oneway(*groups).pvalue) if len(groups) >= 2 else float("nan")
    spread = float(by_tech["mean"].max() - by_tech["mean"].min()) if len(by_tech) else 0.0
    print(f"\nANOVA p-value = {p:.3g} | chênh lệch tỉ lệ giữa KTV nhanh nhất và chậm nhất = {spread:.3f}")
    verdict = ("Có khác biệt KTV có ý nghĩa thống kê" if p < 0.05 else
               "KHÔNG có bằng chứng KTV khác nhau -> dự đoán theo KTV chưa có cơ sở; sửa script sinh dữ liệu")
    print("=>", verdict)
    audit["technician_signal"] = {"anova_p": p, "ratio_spread": spread, "verdict": verdict,
                                  "by_technician": json.loads(by_tech.to_json(orient="index"))}

    # Độ đa dạng tổ hợp: bảng tra phủ được bao nhiêu % ca?
    combos = df.assign(k=df[ISSUE_COL].map(issue_key)).groupby(["k", "technician_id", "device_model_id"]).size()
    audit["diversity"] = {"unique_issue_sets": int(df[ISSUE_COL].map(issue_key).nunique()),
                          "unique_technicians": int(df["technician_id"].nunique()),
                          "unique_devices": int(df["device_model_id"].nunique()),
                          "unique_combos_issue_tech_device": int(len(combos)),
                          "target_mean": float(df[TARGET_COL].mean()), "target_std": float(df[TARGET_COL].std())}
    print("\n=== ĐA DẠNG ===")
    for k, v in audit["diversity"].items():
        print(f"  {k}: {v}")

    (REPORTS_DIR / "data_audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n--> Đã lưu {REPORTS_DIR / 'data_audit.json'}")


if __name__ == "__main__":
    main()
