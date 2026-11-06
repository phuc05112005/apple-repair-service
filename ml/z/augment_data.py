"""
Script: augment_data.py
Mục đích: 
  - Nạp dữ liệu mầm thực tế (data/raw/raw_tickets_active.csv).
  - Phân chia tập mầm thành Train Mầm (80%) và Test Mầm (20%) TRƯỚC KHI sinh dữ liệu (Chống Data Leakage).
  - Thực hiện Domain-Aware Augmentation CHỈ TRÊN TẬP TRAIN MẦM để đạt 3.000 mẫu.
  - Lưu kết quả ra 2 file riêng biệt: data/synthetic/train_augmented.csv và data/synthetic/test_real_seed.csv.
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

# -----------------------------------------------------------------------------
# 1. THIẾT LẬP ĐƯỜNG DẪN DỰ ÁN (TỰ ĐỘNG XÁC ĐỊNH THƯ MỤC GỐC)
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_CSV_PATH = BASE_DIR / "data" / "raw" / "raw_tickets_active.csv"
SYNTHETIC_DIR = BASE_DIR / "data" / "synthetic"

TRAIN_OUT_PATH = SYNTHETIC_DIR / "train_augmented.csv"
TEST_OUT_PATH = SYNTHETIC_DIR / "test_real_seed.csv"


# -----------------------------------------------------------------------------
# 2. HÀM DOMAIN-AWARE AUGMENTATION (CHỈ ÁP DỤNG CHO TẬP TRAIN)
# -----------------------------------------------------------------------------
def augment_repair_dataset(df_source, target_total_rows=3000, random_state=42):
    """
    Sinh dữ liệu mở rộng dựa trên tập Train mầm, bảo toàn logic nghiệp vụ.
    """
    np.random.seed(random_state)
    current_count = len(df_source)

    if current_count >= target_total_rows:
        return df_source.copy()

    needed_samples = target_total_rows - current_count
    augmented_indices = np.random.choice(
        df_source.index, size=needed_samples, replace=True
    )
    df_augmented = df_source.loc[augmented_indices].copy().reset_index(drop=True)

    # 1. Thêm nhiễu thời gian sửa chữa thuần (Net Duration Noise)
    duration_noise = np.random.normal(loc=0.0, scale=3.5, size=needed_samples)
    df_augmented["net_repair_duration_minutes"] = (
        df_augmented["net_repair_duration_minutes"] + duration_noise
    ).round()
    df_augmented["net_repair_duration_minutes"] = df_augmented[
        "net_repair_duration_minutes"
    ].clip(lower=15.0)

    # 2. Thêm nhiễu thời gian tạm dừng nếu ca có biến cố
    has_pause_mask = df_augmented["total_pause_events_count"] > 0
    pause_noise = np.random.normal(
        loc=0.0, scale=2.5, size=has_pause_mask.sum()
    )
    df_augmented.loc[has_pause_mask, "total_pause_duration_minutes"] = (
        df_augmented.loc[has_pause_mask, "total_pause_duration_minutes"]
        + pause_noise
    ).round()
    df_augmented["total_pause_duration_minutes"] = df_augmented[
        "total_pause_duration_minutes"
    ].clip(lower=0.0)

    # 3. Tính toán lại actual_repair_duration_minutes đảm bảo logic 100%
    df_augmented["actual_repair_duration_minutes"] = (
        df_augmented["net_repair_duration_minutes"]
        + df_augmented["total_pause_duration_minutes"]
    )

    # Cấp mã ticket mô phỏng mới
    df_augmented["ticket_code"] = [
        f"ST-SYNTH-{i+1:05d}" for i in range(needed_samples)
    ]

    return pd.concat([df_source, df_augmented], ignore_index=True)


# -----------------------------------------------------------------------------
# 3. CHƯƠNG TRÌNH CHÍNH
# -----------------------------------------------------------------------------
def main():
    SYNTHETIC_DIR.mkdir(parents=True, exist_ok=True)

    if not RAW_CSV_PATH.exists():
        print(f"[LỖI] Không tìm thấy tệp dữ liệu mầm tại: {RAW_CSV_PATH}")
        print("Hãy đảm bảo bạn đã có tệp raw_tickets_active.csv trong thư mục data/raw/")
        sys.exit(1)

    print(f"--> Đang đọc dữ liệu mầm từ: {RAW_CSV_PATH}")
    df_raw = pd.read_csv(RAW_CSV_PATH)

    # Làm sạch dòng thiếu thông tin cơ bản
    df_clean = df_raw.dropna(
        subset=["actual_repair_started_at", "actual_repair_completed_at"]
    ).copy()
    df_clean = df_clean[df_clean["net_repair_duration_minutes"] > 0].reset_index(
        drop=True
    )

    # [BƯỚC CHỐNG LEAKAGE] Chia tập Mầm Train / Test TRƯỚC khi sinh dữ liệu
    seed_train, seed_test = train_test_split(
        df_clean, test_size=0.20, random_state=42
    )

    print(
        f"--> Đã chia tập mầm: Train Mầm = {len(seed_train)} mẫu | Test Mầm = {len(seed_test)} mẫu"
    )

    # Sinh dữ liệu mở rộng CHỈ trên tập Train Mầm
    print("--> Đang tiến hành Augmentation cho tập Train...")
    df_train_augmented = augment_repair_dataset(
        seed_train, target_total_rows=3000, random_state=42
    )

    # Lưu 2 tập dữ liệu riêng biệt vào thư mục data/synthetic/
    df_train_augmented.to_csv(TRAIN_OUT_PATH, index=False, encoding="utf-8-sig")
    seed_test.to_csv(TEST_OUT_PATH, index=False, encoding="utf-8-sig")

    print(f"\n--> [THÀNH CÔNG RỰC RỠ]")
    print(
        f"    + Tập Train (Đã Mở rộng): {df_train_augmented.shape} | File: {TRAIN_OUT_PATH}"
    )
    print(
        f"    + Tập Test  (Dữ liệu Thật): {seed_test.shape} | File: {TEST_OUT_PATH}"
    )


if __name__ == "__main__":
    main()