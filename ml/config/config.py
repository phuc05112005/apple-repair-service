"""Cấu hình trung tâm của pipeline ML v2 (một nguồn sự thật duy nhất cho train + serve)."""
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parent
ML_DIR = CONFIG_DIR.parent

# ------------------------------------------------------------------ Đường dẫn
DATA_DIR = ML_DIR / "data"
RAW_DATA_PATH = DATA_DIR / "raw" / "raw_tickets_active.csv"       # xuất từ DB bởi 01_extract_raw_data.py
MODELS_DIR = ML_DIR / "models" / "v2"
BUNDLE_PATH = MODELS_DIR / "repair_duration_bundle.joblib"        # builder + model + metadata trong MỘT file
REPORTS_DIR = ML_DIR / "reports"
for _d in (RAW_DATA_PATH.parent, MODELS_DIR, REPORTS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------ Cột dữ liệu
TARGET_COL = "net_repair_duration_minutes"   # thời gian thi công THUẦN (đã trừ thời gian chờ)
GROUP_COL = "ticket_id"                      # 1 phiếu = 1 nhóm; không để 1 phiếu nằm ở cả train lẫn test
TIME_COL = "actual_repair_started_at"
ISSUE_COL = "service_issue_ids_list"
CAT_COLS = ["device_model_id", "technician_id"]
NUM_COLS = ["total_services_count", "total_catalog_standard_duration_minutes"]
# Bỏ có chủ đích: branch_id (hiện chỉ 1 chi nhánh = hằng số) và total_parts_quantity_used
# (lúc train = linh kiện đã xuất kho thực tế, lúc dự đoán chưa biết -> lệch train/serve).

# ------------------------------------------------------------------ Huấn luyện
RANDOM_STATE = 42
TEST_SIZE = 0.20
SPLIT_MODE = "group"          # "group": chia ngẫu nhiên theo phiếu | "time": 20% phiếu mới nhất làm test
CV_FOLDS = 5
INTERVAL_COVERAGE = 0.90      # khoảng dự báo 90%
USE_AUGMENTATION = False      # chỉ bật nếu bảng ablation (reports/ablation.csv) chứng minh có lợi
AUGMENT_TARGET_ROWS = 3000
ABLATION_REPEATS = 10

XGB_GRID = {
    "max_depth": [3, 4, 6],
    "learning_rate": [0.03, 0.08],
    "n_estimators": [200, 400],
}
MODEL_NAME = "XGBRegressor"

# ------------------------------------------------------------------ Serving
MIN_PREDICTED_MINUTES = 10.0
DEFAULT_ESTIMATE_MINUTES = 45.0       # dùng khi phiếu chưa có hạng mục sửa chữa nào
FEATURE_CONTRACT_VERSION = "v1"       # GIỮ "v1" cho tới khi kiểm tra MlCandidateEstimateService (Spring Boot)
SYNTHETIC_DATA = True                 # dữ liệu đang là mô phỏng -> nói thật trong API/báo cáo
