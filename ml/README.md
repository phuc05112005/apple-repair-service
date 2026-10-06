# ML Experiment V2 — thời lượng kỹ thuật sửa chữa

Thư mục này triển khai một bài toán duy nhất: hồi quy
`actual_technical_minutes` cho một phiếu sửa chữa đủ điều kiện. Input gồm định
mức dịch vụ, thiết bị, vấn đề, loại dịch vụ, kỹ thuật viên, chi nhánh, thời gian
dự đoán và lịch sử kỹ thuật viên biết được đúng tại thời điểm phân công. Output
là số phút kỹ thuật chủ động dự kiến.

Technical duration khác ETA. ETA còn phải ghép thời lượng dự đoán với hàng đợi,
ca làm, thời gian nghỉ, trạng thái chờ và lịch kỹ thuật viên. Phase này không đổi
ETA runtime, backend, frontend hay database.

## Trạng thái dữ liệu và artifact

Dataset V2 là **controlled synthetic data**, không phải dữ liệu vận hành thật.
Repository chưa có canonical seed đầy đủ cho toàn bộ catalog nên generator dùng
synthetic catalog được version hóa, quan hệ hợp lý cho iPhone, iPad, MacBook,
Apple Watch và AirPods. Hidden factors chỉ tạo nhãn, không xuất thành feature.

Artifact trong `models/experimental_v2/` được gắn nhãn bắt buộc:

> **EXPERIMENTAL — SYNTHETIC-DATA TRAINED — NOT PRODUCTION VALIDATED**

Metric hiện tại chỉ chứng minh pipeline trên phân phối synthetic. Không được gọi
đó là độ chính xác ngoài thực tế.

## Sample và target

Một mẫu là phiếu đã hoàn tất, đúng một repair item `APPROVED`, một assignment,
không transfer và status history đầy đủ. Target là tổng phút trong
`INSPECTING + REPAIRING` giao với assignment. Không tính queue, chờ khách, chờ
linh kiện, break, transfer gap, chờ bàn giao hay appointment waiting.

Persistence `service_interruptions` đã tồn tại nhưng duration service hiện chưa
tự trừ các khoảng này; V2 ghi rõ giới hạn thay vì giả lập integration. Chi tiết
và 14 feature nằm trong [DATA_CONTRACT.md](DATA_CONTRACT.md). Danh sách chính
xác tài liệu môn học và source hệ thống đã đối chiếu nằm trong
[SOURCE_AUDIT.md](SOURCE_AUDIT.md).

## Model competition

Hai baseline bắt buộc:

- Mean baseline: trung bình target của fold train;
- Standard-duration baseline: `prediction = standard_duration_minutes`.

Bốn candidate chính:

1. `RandomForestRegressor`;
2. `HistGradientBoostingRegressor`;
3. `XGBRegressor`;
4. `CatBoostRegressor` qua adapter sklearn 1.8, vẫn dùng categorical native.

CatBoost 1.2.8 có wheel cho Python 3.13 nhưng chưa cung cấp estimator tags mà
scikit-learn 1.8 bắt buộc trong `RandomizedSearchCV`. Adapter trong `models.py`
chỉ bổ sung protocol `BaseEstimator`; model bên trong vẫn là CatBoost native,
không one-hot category và artifact được lưu dạng `.cbm`.

Tất cả dùng cùng dataset, target, chronological 85/15 split, bốn
`TimeSeriesSplit` folds và `neg_mean_absolute_error`. Mỗi model có 8 cấu hình
`RandomizedSearchCV` với seed `20261005`. Test 15% cuối không tham gia
preprocessing, tuning hoặc khóa winner.

Quy tắc khóa winner được khai báo trước: MAE temporal CV thấp nhất. Các model
chênh không quá 0,25 phút được xem là gần ngang về nghiệp vụ; lần lượt xét CV
MAE std, RMSE, P90 absolute error và độ phức tạp. Sau khi khóa, cả bốn model mới
được fit trên toàn development và báo cáo trên holdout để so sánh minh bạch.

## Cài đặt và tái lập

Chạy từ repository root bằng Python 3.13:

```powershell
python -m pip install -r ml/requirements.txt
python ml/generate_synthetic_repair_duration.py
python -m pytest ml/tests -q
```

Generator mặc định tạo đúng 5.000 hàng tại
`ml/data/synthetic_repair_duration_v2.csv`. V1 được giữ để audit, nhưng V2 là
input của experiment hiện tại.

## Notebook

Notebook nghiên cứu là `ml/01_repair_duration_regression.ipynb`. Chạy bằng
Restart Kernel → Run All, hoặc:

```powershell
python -m jupyter nbconvert --to notebook --execute `
  --ExecutePreprocessor.timeout=1800 `
  --inplace ml/01_repair_duration_regression.ipynb
```

Notebook dùng cùng code trong `ml/src/repair_duration_ml/` với CLI, trình bày
đủ công thức MAE/MSE/RMSE/R²/P90AE, Random Forest, HGB, objective bậc hai có
regularization của XGBoost và ordered target statistics của CatBoost.

## Training CLI

```powershell
python ml/train_repair_duration_models.py `
  --data ml/data/synthetic_repair_duration_v2.csv `
  --output-dir ml/models/experimental_v2
```

Output gồm model winner, metadata, metrics, feature contract snapshot, bảng CV,
bảng test, predictions, subgroup errors, permutation importance và diagnostic
plots. `--smoke` chỉ dành cho CI/test nhỏ; không dùng metric smoke trong báo cáo.

Kết quả full run thực tế được ghi tại
[EXPERIMENT_RESULTS.md](EXPERIMENT_RESULTS.md). `metadata.json` chứa hash dataset,
seed, versions, split, hyperparameters, thời gian fit/predict và kích thước
artifact.

## Cấu trúc chính

```text
ml/
├── 01_repair_duration_regression.ipynb
├── generate_synthetic_repair_duration.py
├── train_repair_duration_models.py
├── DATA_CONTRACT.md
├── EXPERIMENT_RESULTS.md
├── data/synthetic_repair_duration_v1.csv
├── data/synthetic_repair_duration_v2.csv
├── models/experimental_v2/
├── src/repair_duration_ml/
└── tests/test_synthetic_repair_duration.py
```

## Phase dữ liệu thật tiếp theo

```text
MySQL business data
→ real-data extractor
→ real_repair_duration_vX dataset
→ same feature contract
→ same training pipeline
→ retrain
→ validate real temporal holdout
→ explicit model approval
→ runtime integration
```

Phase hiện tại không có satisfaction classifier, FastAPI, Spring runtime
integration, automatic retraining, production MySQL extractor, auto-assignment
hoặc ML prediction UI.
