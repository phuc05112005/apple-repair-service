# Apple Repair Service — ML experiments

Thư mục này chứa thực nghiệm duy nhất: **hồi quy thời lượng kỹ thuật chủ động**.
Kết quả dự đoán chưa phải ETA; ETA còn cần queue KTV, lịch làm việc, break và
trạng thái vận hành.

## Lịch sử phiên bản

- V2 được đóng băng để audit tại synthetic_repair_duration_v2.csv,
  models/experimental_v2/, 01_repair_duration_regression.ipynb,
  DATA_CONTRACT_V2.md, EXPERIMENT_RESULTS_V2.md và các entry point hậu tố v2.
  V2 từng biểu diễn WARRANTY như một service_type.
- V3 dùng technical_action = REPAIR | REPLACEMENT và is_warranty = 0 | 1,
  thêm history KTV theo issue và exact catalog, dùng seed 20261006, holdout mới
  và tolerance metrics ±15/±30/±45 phút.

Mọi artifact đều mang nhãn **EXPERIMENTAL — SYNTHETIC-DATA TRAINED — NOT
PRODUCTION VALIDATED**.

## Cấu trúc V3

- generate_synthetic_repair_duration_v3.py: generator deterministic, không DB.
- src/repair_duration_ml_v3/: validation, preprocessing, model competition,
  metrics và artifact writer dùng chung cho CLI/notebook.
- train_repair_duration_models.py: full CLI V3 độc lập notebook.
- 02_repair_duration_regression_v3.ipynb: nghiên cứu và công thức V3.
- data/synthetic_repair_duration_v3.csv: 5.000 sample tổng hợp.
- models/experimental_v3/: winner và bằng chứng đánh giá.
- EXPERIMENT_RESULTS_V3.md: báo cáo được render từ artifact của full run.
- tests/test_repair_duration_v3.py: semantic, as-of leakage, cold start, split,
  metrics và smoke training.

## Chạy tái lập

Từ repository root:

~~~powershell
python -m pip install -r ml/requirements.txt
python ml/generate_synthetic_repair_duration_v3.py
python -m pytest ml/tests -q
python ml/train_repair_duration_models.py --data ml/data/synthetic_repair_duration_v3.csv --output-dir ml/models/experimental_v3 --search-iterations 12
python ml/build_repair_duration_notebook_v3.py
~~~

Sau đó Restart Kernel → Run All notebook. CLI và notebook import cùng package
repair_duration_ml_v3; không copy thuật toán huấn luyện sang notebook.

## Kỷ luật thí nghiệm

- 85% thời gian đầu development, 15% cuối untouched holdout;
- TimeSeriesSplit(4) giống nhau cho bốn model;
- 12 cấu hình randomized/model, scoring MAE;
- winner chỉ dựa development CV, near tie ≤ 0,25 phút;
- Mean và StandardDuration là hai baseline;
- holdout không dùng để thay winner;
- feature history chỉ thấy job hoàn tất trước prediction time.

Không có satisfaction classifier, FastAPI, Spring client, DB extractor,
auto-assignment, automatic retraining hoặc thay đổi ETA trong phase này.
