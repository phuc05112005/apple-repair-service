"""Bước 2 (kiểm tra nhanh, không bắt buộc): KIỂM TRA DỮ LIỆU trước khi huấn luyện. Lưu reports/data_audit.json.
Trả lời: dữ liệu có sạch không? có tín hiệu KTV (đã hiệu chỉnh độ khó ca) không? trần nhiễu bao nhiêu?"""
import json
import sys
from pathlib import Path

import pandas as pd

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

from config.config import GROUP_COL, ISSUE_COL, MAX_PLAUSIBLE_MINUTES, RAW_DATA_PATH, REPORTS_DIR, TARGET_COL, TICKET_CODE_PREFIX
from src.evaluation import technician_effect_test, twin_noise_floor
from src.features import clean_training_data, issue_key


def main():
    df, rep = clean_training_data(pd.read_csv(RAW_DATA_PATH), TARGET_COL, GROUP_COL, MAX_PLAUSIBLE_MINUTES, TICKET_CODE_PREFIX)
    print("=== LÀM SẠCH ===")
    for k, v in rep.items():
        print(f"  {k}: {v}")
    anc = technician_effect_test(df, TARGET_COL, ISSUE_COL)
    ok = anc["p_value"] < 0.05
    print(f"\n=== TÍN HIỆU KTV (ANCOVA, đã hiệu chỉnh độ khó ca) ===\n  F={anc['F']:.1f} p={anc['p_value']:.2e} "
          f"partial eta^2={anc['partial_eta2']:.3f}\n  hệ số tốc độ: { {k: round(v, 3) for k, v in anc['factors'].items()} }")
    print("=>", "Có khác biệt KTV có ý nghĩa thống kê" if ok else "KHÔNG có bằng chứng KTV khác nhau -> dự đoán theo KTV chưa có cơ sở")
    noise = twin_noise_floor(df, TARGET_COL, ISSUE_COL)
    print(f"\n=== TRẦN NHIỄU (phiếu song sinh) ===\n  RMSE >= {noise['noise_rmse_floor']:.2f} | MAE xấp xỉ >= {noise['noise_mae_floor']:.2f} "
          f"| phủ {noise['share_covered']:.0%} số phiếu")
    div = {"unique_issue_sets": int(df[ISSUE_COL].map(issue_key).nunique()), "unique_technicians": int(df["technician_id"].nunique()),
           "unique_devices": int(df["device_model_id"].nunique()), "target_mean": float(df[TARGET_COL].mean()),
           "target_std": float(df[TARGET_COL].std())}
    print("\n=== ĐA DẠNG ===", div)
    audit = {"cleaning": rep, "technician_signal": {k: v for k, v in anc.items()}, "noise_floor": noise, "diversity": div}
    (REPORTS_DIR / "data_audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2, default=float), encoding="utf-8")
    print(f"\n--> Đã lưu {REPORTS_DIR / 'data_audit.json'}")


if __name__ == "__main__":
    main()
