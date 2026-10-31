from pathlib import Path

# Đường dẫn thư mục gốc ml/
CONFIG_DIR = Path(__file__).resolve().parent
ML_DIR = CONFIG_DIR.parent

# Đường dẫn Dữ liệu
DATA_DIR = ML_DIR / "data"
RAW_SYNTHETIC_PATH = DATA_DIR / "synthetic" / "synthetic_tickets_3500.csv"
PROCESSED_DATA_PATH = DATA_DIR / "processed" / "processed_ml_dataset_3500.csv"

#RAW_SYNTHETIC_PATH = DATA_DIR / "raw" / "raw_tickets_active.csv"
#PROCESSED_DATA_PATH = DATA_DIR / "processed" / "processed_ml_dataset_real.csv"


# Đường dẫn Lưu Trữ Mô Hình
MODELS_DIR = ML_DIR / "models"
EXPERIMENTAL_MODEL_DIR = MODELS_DIR / "experimental"
EXPERIMENTAL_MODEL_DIR.mkdir(parents=True, exist_ok=True)

PREPROCESSOR_PATH = EXPERIMENTAL_MODEL_DIR / "feature_preprocessor.pkl"
BEST_MODEL_PATH = EXPERIMENTAL_MODEL_DIR / "best_repair_duration_model.pkl"

# Biến Mục Tiêu
TARGET_COL = "net_repair_duration_minutes"

# Danh sách cột loại bỏ do rò rỉ dữ liệu (Anti-Data Leakage)
COLS_TO_DROP = [
    "ticket_id",
    "ticket_code",
    "device_model_name",
    "technician_name",
    "service_issue_names_list",
    "service_type_codes_list",
    "actual_repair_started_at",
    "actual_repair_completed_at",
    "actual_repair_duration_minutes",
    "total_pause_duration_minutes",
    "total_pause_events_count",
    "count_waiting_part_events",
    "count_waiting_approval_events",
    "is_reassigned",
]

# Cột Mã Hóa & Ngưỡng Lọc Feature
ISSUE_COL = "service_issue_ids_list"
CAT_COLS = ["device_model_id", "technician_id", "branch_id"]
CORR_THRESHOLD = 0.005  # Ngưỡng tương quan Pearson tối thiểu

# Cấu Hình Siêu Tham Số
RANDOM_STATE = 42
TEST_SIZE = 0.20