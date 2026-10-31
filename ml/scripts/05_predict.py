import importlib
import sys
from pathlib import Path
import joblib
import pandas as pd

# 1. Định tuyến sys.path để import từ thư mục gốc ml/
SCRIPT_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPT_DIR.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

from config.config import BEST_MODEL_PATH, PREPROCESSOR_PATH

# 2. Nạp động module 03_preprocessing qua importlib (tránh lỗi tên file bắt đầu bằng số)
preprocessing_module = importlib.import_module("scripts.03_preprocessing")
RepairDataPreprocessor = preprocessing_module.RepairDataPreprocessor

# 3. Ánh xạ class vào __main__ để joblib giải nén (unpickle) không bị lỗi
import __main__
setattr(__main__, "RepairDataPreprocessor", RepairDataPreprocessor)


def predict_repair_time(new_tickets_df: pd.DataFrame) -> pd.DataFrame:
    """Nhận vào DataFrame phiếu mới (chưa qua xử lý) và trả về kết quả dự đoán thời gian thi công."""
    if not PREPROCESSOR_PATH.exists() or not BEST_MODEL_PATH.exists():
        raise FileNotFoundError("Không tìm thấy tệp preprocessor hoặc model. Hãy chạy script 03 và 04 trước!")

    preprocessor = joblib.load(PREPROCESSOR_PATH)
    model = joblib.load(BEST_MODEL_PATH)

    # Xử lý đặc trưng bằng Preprocessor
    df_eng = preprocessor.add_domain_ratios(new_tickets_df)
    X_processed = preprocessor.transform(df_eng)

    # Chạy dự đoán
    predictions = model.predict(X_processed)

    # Gán kết quả dự đoán vào DataFrame
    result_df = new_tickets_df.copy()
    result_df["predicted_repair_duration_minutes"] = predictions.round(1)

    return result_df


def main():
    print("=== CHẠY THỬ NGHIỆM DỰ ĐOÁN PHIẾU SỬA CHỮA MỚI ===")

    # Giả lập dữ liệu 2 phiếu sửa chữa đầu vào từ khách hàng
    sample_tickets = pd.DataFrame([
        {
            "device_model_id": 12,
            "technician_id": 4,
            "branch_id": 1,
            "service_issue_ids_list": "1, 6",  # Lỗi thay màn hình + sửa nguồn
            "total_catalog_standard_duration_minutes": 60.0,
            "total_services_count": 2,
            "total_parts_quantity_used": 3,
        },
        {
            "device_model_id": 5,
            "technician_id": 2,
            "branch_id": 1,
            "service_issue_ids_list": "3",     # Thay pin
            "total_catalog_standard_duration_minutes": 30.0,
            "total_services_count": 1,
            "total_parts_quantity_used": 1,
        },
    ])

    results = predict_repair_time(sample_tickets)

    output_cols = [
        "device_model_id",
        "technician_id",
        "service_issue_ids_list",
        "total_catalog_standard_duration_minutes",
        "predicted_repair_duration_minutes",
    ]
    print("\nKết quả dự đoán:")
    print(results[output_cols].to_string(index=False))


if __name__ == "__main__":
    main()