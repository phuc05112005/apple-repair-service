"""Augmentation (TÙY CHỌN, mặc định TẮT). Chỉ áp dụng cho TẬP TRAIN, sau khi đã tách test.
Lưu ý: bản sao giữ nguyên X, chỉ thêm nhiễu vào nhãn -> không tạo thông tin mới.
Chỉ dùng khi ablation chứng minh có lợi."""
import numpy as np
import pandas as pd


def augment_repair_dataset(df_source: pd.DataFrame, target_total_rows: int = 3000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    need = target_total_rows - len(df_source)
    if need <= 0:
        return df_source.copy()
    idx = rng.choice(df_source.index.to_numpy(), size=need, replace=True)
    aug = df_source.loc[idx].copy().reset_index(drop=True)
    aug["net_repair_duration_minutes"] = (
        aug["net_repair_duration_minutes"] + rng.normal(0.0, 3.5, size=need)
    ).round().clip(lower=15.0)
    if "total_pause_events_count" in aug.columns:
        m = (aug["total_pause_events_count"] > 0).to_numpy()
        aug.loc[m, "total_pause_duration_minutes"] = (
            aug.loc[m, "total_pause_duration_minutes"] + rng.normal(0.0, 2.5, size=int(m.sum()))
        ).round().clip(lower=0.0)
    aug["is_augmented"] = 1
    out = pd.concat([df_source.assign(is_augmented=0), aug], ignore_index=True)
    return out
