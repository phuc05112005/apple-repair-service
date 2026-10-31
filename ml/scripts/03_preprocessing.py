import sys
from pathlib import Path
import joblib
import pandas as pd
from sklearn.preprocessing import MultiLabelBinarizer, OneHotEncoder

# Re-route sys.path để import config
SCRIPT_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPT_DIR.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

from config.config import (
    CAT_COLS,
    COLS_TO_DROP,
    CORR_THRESHOLD,
    ISSUE_COL,
    PREPROCESSOR_PATH,
    PROCESSED_DATA_PATH,
    RAW_SYNTHETIC_PATH,
    TARGET_COL,
)


class RepairDataPreprocessor:
    """Class đảm nhận toàn bộ luồng Tiền xử lý, Mã hóa và Lọc Đặc trưng cho cả Train và Inference."""

    def __init__(self):
        self.mlb = MultiLabelBinarizer()
        self.ohe = OneHotEncoder(sparse_output=False, drop="first", handle_unknown="ignore")
        self.issue_cols = []
        self.ohe_cols = []
        self.pruned_features = []

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Lọc bỏ các ca chuyển giao (is_reassigned != 0) và cột rò rỉ dữ liệu."""
        df_clean = df[df["is_reassigned"] == 0].copy() if "is_reassigned" in df.columns else df.copy()
        drop_cols = [col for col in COLS_TO_DROP if col in df_clean.columns]
        return df_clean.drop(columns=drop_cols)

    def add_domain_ratios(self, df: pd.DataFrame) -> pd.DataFrame:
        """Thêm các đặc trưng tỷ lệ nghiệp vụ (Domain Ratios)."""
        df_out = df.copy()
        df_out["duration_per_service"] = (
            df_out["total_catalog_standard_duration_minutes"] / df_out["total_services_count"]
        )
        df_out["parts_per_service"] = (
            df_out["total_parts_quantity_used"] / df_out["total_services_count"]
        )
        return df_out

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Mã hóa đa nhãn, One-Hot và lọc các đặc trưng nhiễu/đa cộng tuyến."""
        df_out = df.copy()

        # 1. MultiLabelBinarizer cho mã lỗi
        parsed_issues = df_out[ISSUE_COL].astype(str).apply(
            lambda x: [int(i.strip()) for i in x.split(",") if i.strip().isdigit()]
        )
        issue_matrix = self.mlb.fit_transform(parsed_issues)
        self.issue_cols = [f"issue_id_{cls}" for cls in self.mlb.classes_]
        df_issues = pd.DataFrame(issue_matrix, columns=self.issue_cols, index=df_out.index)

        # 2. OneHotEncoder cho ID thiết bị, kỹ thuật viên và chi nhánh
        cat_matrix = self.ohe.fit_transform(df_out[CAT_COLS])
        self.ohe_cols = list(self.ohe.get_feature_names_out(CAT_COLS))
        df_cat = pd.DataFrame(cat_matrix, columns=self.ohe_cols, index=df_out.index)

        # Gộp bảng
        df_full = pd.concat(
            [df_out.drop(columns=[ISSUE_COL] + CAT_COLS), df_issues, df_cat], axis=1
        )

        # 3. Phân tích tương quan Pearson để cắt tỉa đặc trưng (Feature Pruning)
        X_cols = [c for c in df_full.columns if c != TARGET_COL]
        corr_series = df_full[X_cols].apply(lambda col: col.corr(df_full[TARGET_COL]))
        abs_corr = corr_series.abs()

        # Tìm các cột có tương quan yếu < 0.005 + Cột đa cộng tuyến parts_per_service (r = 1.00)
        low_corr_cols = abs_corr[abs_corr < CORR_THRESHOLD].index.tolist()
        multicollinear_cols = ["parts_per_service"] if "parts_per_service" in df_full.columns else []

        self.pruned_features = list(set(low_corr_cols + multicollinear_cols))

        # Loại bỏ đặc trưng dư thừa
        df_pruned = df_full.drop(columns=self.pruned_features)
        return df_pruned

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Dùng mã hóa và lọc đặc trưng cho dữ liệu mới (Inference)."""
        df_out = df.copy()

        parsed_issues = df_out[ISSUE_COL].astype(str).apply(
            lambda x: [int(i.strip()) for i in x.split(",") if i.strip().isdigit()]
        )
        issue_matrix = self.mlb.transform(parsed_issues)
        df_issues = pd.DataFrame(issue_matrix, columns=self.issue_cols, index=df_out.index)

        cat_matrix = self.ohe.transform(df_out[CAT_COLS])
        df_cat = pd.DataFrame(cat_matrix, columns=self.ohe_cols, index=df_out.index)

        df_full = pd.concat(
            [df_out.drop(columns=[ISSUE_COL] + CAT_COLS), df_issues, df_cat], axis=1
        )
        
        # Bỏ những cột đã bị loại ở bước fit
        existing_pruned = [c for c in self.pruned_features if c in df_full.columns]
        return df_full.drop(columns=existing_pruned)


def main():
    print(f"1. Tải dữ liệu thô từ: {RAW_SYNTHETIC_PATH}")
    if not RAW_SYNTHETIC_PATH.exists():
        raise FileNotFoundError(f"Không thấy file dữ liệu đầu vào tại {RAW_SYNTHETIC_PATH}!")

    df_raw = pd.read_csv(RAW_SYNTHETIC_PATH)

    processor = RepairDataPreprocessor()

    print("2. Làm sạch & Loại bỏ rò rỉ dữ liệu (Data Leakage)...")
    df_clean = processor.clean_data(df_raw)

    print("3. Thêm đặc trưng tỷ lệ nghiệp vụ (Domain Ratios)...")
    df_eng = processor.add_domain_ratios(df_clean)

    print("4. Mã hóa & Cắt tỉa đặc trưng (Feature Pruning)...")
    df_processed = processor.fit_transform(df_eng)

    print(f"   + Số đặc trưng bị loại bỏ: {len(processor.pruned_features)} cột")
    print(f"   + Danh sách cột loại: {processor.pruned_features}")

    # Xuất dữ liệu đã xử lý
    PROCESSED_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    df_processed.to_csv(PROCESSED_DATA_PATH, index=False)
    print(f"--> [THÀNH CÔNG] Đã lưu dataset sạch tại: {PROCESSED_DATA_PATH} ({df_processed.shape})")

    # Lưu Preprocessor dưới dạng Artifact (.pkl)
    joblib.dump(processor, PREPROCESSOR_PATH)
    print(f"--> [THÀNH CÔNG] Đã lưu Preprocessor tại: {PREPROCESSOR_PATH}")


if __name__ == "__main__":
    main()