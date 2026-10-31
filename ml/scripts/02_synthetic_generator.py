from pathlib import Path
import numpy as np
import pandas as pd

# -----------------------------------------------------------------------------
# CẤU HÌNH ĐƯỜNG DẪN CÁC THƯ MỤC DATA
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_CSV_PATH = BASE_DIR / "data" / "raw" / "raw_tickets_active.csv"
SYNTHETIC_CSV_PATH = BASE_DIR / "data" / "synthetic" / "synthetic_tickets_3500.csv"


# -----------------------------------------------------------------------------
# THUẬT TOÁN DOMAIN-AWARE AUGMENTATION
# -----------------------------------------------------------------------------
def augment_repair_dataset(df_source, target_total_rows=3500, random_state=42):
    """Sinh dữ liệu nhân bản giữ nguyên ràng buộc nghiệp vụ vận hành."""
    np.random.seed(random_state)
    current_count = len(df_source)

    if current_count >= target_total_rows:
        return df_source.copy()

    needed_samples = target_total_rows - current_count
    augmented_indices = np.random.choice(
        df_source.index, size=needed_samples, replace=True
    )
    df_augmented = df_source.loc[augmented_indices].copy().reset_index(drop=True)

    # 1. Sinh nhiễu thời gian thi công thuần (Net Duration Noise)
    duration_noise = np.random.normal(loc=0.0, scale=3.5, size=needed_samples)
    df_augmented["net_repair_duration_minutes"] = (
        df_augmented["net_repair_duration_minutes"] + duration_noise
    ).round()
    df_augmented["net_repair_duration_minutes"] = df_augmented[
        "net_repair_duration_minutes"
    ].apply(lambda x: max(15.0, x))

    # 2. Sinh nhiễu thời gian tạm dừng nếu ca đó có biến cố
    has_pause_mask = df_augmented["total_pause_events_count"] > 0
    pause_noise = np.random.normal(loc=0.0, scale=2.5, size=needed_samples)
    df_augmented.loc[has_pause_mask, "total_pause_duration_minutes"] = (
        df_augmented.loc[has_pause_mask, "total_pause_duration_minutes"]
        + pause_noise[has_pause_mask]
    ).round()
    df_augmented["total_pause_duration_minutes"] = df_augmented[
        "total_pause_duration_minutes"
    ].apply(lambda x: max(0.0, x))

    # 3. Tính lại actual_repair_duration_minutes khớp 100% logic
    df_augmented["actual_repair_duration_minutes"] = (
        df_augmented["net_repair_duration_minutes"]
        + df_augmented["total_pause_duration_minutes"]
    )

    df_augmented["ticket_code"] = [
        f"ST-SYNTH-{i+1:05d}" for i in range(needed_samples)
    ]

    df_final = pd.concat([df_source, df_augmented], ignore_index=True)
    return df_final


def main():
    if not RAW_CSV_PATH.exists():
        raise FileNotFoundError(
            f"Chưa thấy file {RAW_CSV_PATH}. Hãy chạy 01_extract_raw_data.py trước!"
        )

    print(f"--> Đang đọc dữ liệu gốc từ: {RAW_CSV_PATH}")
    df_raw = pd.read_csv(RAW_CSV_PATH)

    df_clean = df_raw.dropna(
        subset=["actual_repair_started_at", "actual_repair_completed_at"]
    ).copy()
    df_clean = df_clean[df_clean["net_repair_duration_minutes"] > 0].reset_index(
        drop=True
    )

    # 1. SINH DỮ LIỆU THÔ MÔ PHỎNG (DATA AUGMENTATION)
    print("--> Đang tiến hành sinh dữ liệu mở rộng (Data Augmentation)...")
    df_synth = augment_repair_dataset(df_clean, target_total_rows=3500)

    # 2. LƯU TỆP CSV THÔ MÔ PHỎNG
    SYNTHETIC_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    df_synth.to_csv(SYNTHETIC_CSV_PATH, index=False, encoding="utf-8-sig")
    print(
        f"--> [THÀNH CÔNG] Đã lưu tệp dữ liệu thô mô phỏng ({len(df_synth)} dòng) vào: {SYNTHETIC_CSV_PATH}"
    )


if __name__ == "__main__":
    main()