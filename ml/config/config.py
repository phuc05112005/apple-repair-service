"""Cấu hình trung tâm của pipeline ML v3 (MỘT nguồn sự thật cho notebook, scripts và API).
Mọi hằng số dùng khi huấn luyện lẫn khi phục vụ (serving) đều nằm ở đây."""
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parent
ML_DIR = CONFIG_DIR.parent

# ------------------------------------------------------------------ Đường dẫn
DATA_DIR = ML_DIR / "data"
RAW_DATA_PATH = DATA_DIR / "raw" / "raw_tickets_active.csv"       # xuất từ DB bởi scripts/01_extract_raw_data.py
MODELS_DIR = ML_DIR / "models" / "v2"
BUNDLE_PATH = MODELS_DIR / "repair_duration_bundle.joblib"        # builder + model + metadata trong MỘT file
REPORTS_DIR = ML_DIR / "reports"
for _d in (RAW_DATA_PATH.parent, MODELS_DIR, REPORTS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------ Cột dữ liệu
TARGET_COL = "net_repair_duration_minutes"   # thời gian thi công THUẦN (đã trừ thời gian chờ linh kiện / chờ duyệt)
GROUP_COL = "ticket_id"                      # 1 phiếu = 1 nhóm; không để 1 phiếu nằm ở cả train lẫn test
TIME_COL = "actual_repair_started_at"
ISSUE_COL = "service_issue_ids_list"
CAT_COLS = ["device_model_id", "technician_id"]
NUM_COLS = ["total_services_count", "total_catalog_standard_duration_minutes"]
FEATURE_COLS = NUM_COLS + CAT_COLS + [ISSUE_COL]   # 5 thuộc tính gốc, tất cả biết được tại thời điểm t0
# Bỏ có chủ đích: branch_id (hằng số) và total_parts_quantity_used
# (lúc train = linh kiện đã xuất kho thực tế, lúc dự đoán chưa biết -> lệch train/serve).

# ------------------------------------------------------------------ Làm sạch
TICKET_CODE_PREFIX = "ST-SEED-"  # chỉ huấn luyện trên phiếu do script seed sinh (None = không lọc). Đặt None khi dùng dữ liệu vận hành thật.
MAX_PLAUSIBLE_MINUTES = 480.0   # nhãn > 8 giờ thi công thuần coi là nhập liệu lỗi (quên đóng phiếu)

# ------------------------------------------------------------------ Huấn luyện / đánh giá
RANDOM_STATE = 42
TEST_SIZE = 0.20
SPLIT_MODE = "group"          # "group": chia ngẫu nhiên theo phiếu | "time": 20% phiếu mới nhất làm test
CV_FOLDS = 5                  # vòng ngoài (đánh giá)
INNER_CV_FOLDS = 3            # vòng trong (chọn siêu tham số) của nested CV
INTERVAL_COVERAGE = 0.90      # khoảng dự báo 90%
QUICK_MODE = False            # True: lưới tham số rút gọn để chạy thử nhanh (KHÔNG dùng cho kết quả báo cáo)
N_JOBS = -1

AUGMENT_FACTOR = 3.0          # Bước 13 (ablation): nhân bản train lên bao nhiêu lần để kiểm chứng augmentation
ABLATION_REPEATS = 8

MODEL_NAME = "XGBRegressor"   # chỉ là giá trị mặc định; tên thật lấy từ mô hình thắng cuộc trong bundle

# ------------------------------------------------------------------ Serving
MIN_PREDICTED_MINUTES = 10.0
DEFAULT_ESTIMATE_MINUTES = 45.0       # dùng khi phiếu chưa có hạng mục sửa chữa nào
FEATURE_CONTRACT_VERSION = "v1"       # GIỮ "v1": hợp đồng đầu vào API với Spring Boot không đổi
SYNTHETIC_DATA = True                 # dữ liệu đang là mô phỏng -> nói thật trong API/báo cáo; đổi False khi dùng dữ liệu vận hành thật
RETRAIN_MAE_RATIO = 1.5               # MAE thực tế > 1.5 x MAE lúc test -> khuyến nghị huấn luyện lại
