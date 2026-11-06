"""Bước 4 (tùy chọn): augmentation có thật sự giúp không? Lặp nhiều lần chia để tránh kết luận theo may rủi.
Chỉ khi kết quả cho thấy 'seed + augment' tốt hơn rõ rệt (> 1 độ lệch chuẩn) mới đặt USE_AUGMENTATION=True."""
import sys
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

from config.config import (ABLATION_REPEATS, AUGMENT_TARGET_ROWS, GROUP_COL, RAW_DATA_PATH, REPORTS_DIR,
                           TARGET_COL, TEST_SIZE, XGB_GRID)
from src.evaluation import regression_report
from src.features import clean_training_data
from src.modeling import fit_predict


def main():
    df, _ = clean_training_data(pd.read_csv(RAW_DATA_PATH), TARGET_COL, GROUP_COL)
    params = {k: v[len(v) // 2] for k, v in XGB_GRID.items()}   # tham số trung tâm, đủ để so sánh công bằng
    rows = []
    for s in range(ABLATION_REPEATS):
        tr, te = train_test_split(df, test_size=TEST_SIZE, random_state=s)
        for aug in (False, True):
            r = regression_report(te[TARGET_COL], fit_predict(tr, te, params, aug, AUGMENT_TARGET_ROWS, seed=s))
            rows.append({"train_data": "seed + augment" if aug else "chỉ seed", **r})
    res = pd.DataFrame(rows).groupby("train_data")[["MAE", "RMSE", "R2"]].agg(["mean", "std"]).round(3)
    res.to_csv(REPORTS_DIR / "ablation.csv")
    print(res.to_string())
    a, b = res.loc["chỉ seed", ("MAE", "mean")], res.loc["seed + augment", ("MAE", "mean")]
    sd = res.loc["chỉ seed", ("MAE", "std")]
    print("\n=>", "Augmentation CÓ lợi" if a - b > sd else "Augmentation KHÔNG lợi rõ rệt -> giữ USE_AUGMENTATION=False")


if __name__ == "__main__":
    main()
