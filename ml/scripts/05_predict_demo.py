"""Bước 5: chạy thử dự đoán không cần DB (dùng để kiểm tra bundle sau khi train)."""
import sys
from pathlib import Path

import pandas as pd

ML_DIR = Path(__file__).resolve().parent.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

from src.inference import load_bundle, predict_for_technician_ids


def main():
    bundle = load_bundle()
    md = bundle.metadata
    print(f"Model {md['model_name']} {md['model_version']} | dữ liệu mô phỏng: {md['synthetic_data']} | "
          f"MAE test = {md['test_metrics']['MAE']:.2f} phút | khoảng ±{md['interval_halfwidth_minutes']:.1f} phút")
    ticket = pd.DataFrame([{
        "device_model_id": bundle.builder.categories_["device_model_id"][0],
        "technician_id": bundle.technician_ids[0],
        "service_issue_ids_list": "1,6",
        "total_services_count": 2,
        "total_catalog_standard_duration_minutes": 105.0,
    }])
    print("\nCùng 1 phiếu, thử lần lượt từng KTV:")
    print(predict_for_technician_ids(ticket, bundle.technician_ids, bundle).to_string(index=False))


if __name__ == "__main__":
    main()
