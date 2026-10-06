# Repair Technical Duration Regression — Data Contract V3

Trạng thái: **EXPERIMENTAL — SYNTHETIC-DATA TRAINED — NOT PRODUCTION
VALIDATED**. V3 không đọc MySQL và chưa tích hợp runtime.

## Bài toán, thời điểm dự đoán và target

Một sample là một ServiceTicket đã hoàn tất, có đúng một RepairItem APPROVED,
đúng một ServiceCatalogItem cụ thể, đúng một Assignment đã có ended_at, không
có transfer được chấp nhận, status history đầy đủ và target dương. Ticket nhiều
hạng mục hoặc nhiều KTV bị loại vì schema không có timer thực tế theo từng hạng
mục.

Thời điểm dự đoán là lần phân công duy nhất sau khi phương án một hạng mục đã
biết. Target:

actual_technical_minutes = tổng (INSPECTING + REPAIRING) giao assignment interval.

Không tính queue ASSIGNED, WAITING_APPROVAL, WAITING_PART, break, transfer gap,
WAITING_HANDOVER hoặc thời gian chờ lịch. service_interruptions đã được lưu
nhưng RepairDurationService hiện chưa tự trừ, nên V3 không giả vờ đã trừ.

## Sửa semantic bảo hành trong V3

V2 dùng service_type = REPAIR | REPLACEMENT | WARRANTY. V3 tách đúng nghiệp vụ:

- technical_action = REPAIR | REPLACEMENT;
- is_warranty = 0 | 1.

is_warranty trong extractor thật sẽ lấy từ
repair_items.warranty_source_item_id IS NOT NULL. Với ca bảo hành,
technical_action phải resolve theo thứ tự dữ liệu sẵn có từ
repair_items.warranty_remedy, service_catalog_items.warranty_remedy, hoặc
catalog kỹ thuật thực tế, rồi chuẩn hóa thành REPAIR/REPLACEMENT.
service_types.code = WARRANTY vẫn được giữ ở production để tương thích; V3 chỉ
chuẩn hóa ở tầng ML.

## Feature contract chính xác

| Feature | Kiểu | Nguồn production dự kiến | Quy tắc availability/cold start |
|---|---|---|---|
| device_type | category | ticket → customer device → model → type | biết trước dự đoán |
| device_model | category | ticket device model | biết trước dự đoán |
| service_issue | category | approved item → catalog → issue | biết trước dự đoán |
| technical_action | category | service type/remedy/catalog kỹ thuật, chuẩn hóa | chỉ REPAIR, REPLACEMENT |
| is_warranty | binary numeric | warranty_source_item_id IS NOT NULL | 0/1, không phải action |
| catalog_service | category | concrete catalog item/name snapshot | biết trước dự đoán |
| standard_duration_minutes | numeric | catalog | giữ nguyên định mức |
| technician_id | category | single assignment | không dùng PII |
| branch_id | category | ticket branch | biết trước dự đoán |
| prediction_month | category | business timestamp | M01…M12 |
| prediction_weekday | category | business timestamp | MON…SUN |
| technician_jobs_completed_before | numeric | lịch sử KTV hợp lệ | 0 nếu chưa có |
| technician_average_duration_before | numeric | mean target lịch sử KTV | NaN nếu count 0 |
| technician_historical_efficiency_before | numeric | mean(actual/standard) lịch sử KTV | NaN nếu count 0 |
| technician_issue_jobs_before | numeric | lịch sử KTV + issue | 0 nếu chưa có |
| technician_issue_average_duration_before | numeric | mean target KTV + issue | NaN nếu count 0 |
| technician_issue_efficiency_before | numeric | mean(actual/standard) KTV + issue | NaN nếu count 0 |
| technician_catalog_jobs_before | numeric | lịch sử KTV + exact catalog | 0 nếu chưa có |
| technician_catalog_average_duration_before | numeric | mean target KTV + catalog | NaN nếu count 0 |
| technician_catalog_efficiency_before | numeric | mean(actual/standard) KTV + catalog | NaN nếu count 0 |

Dataset có 20 feature, cộng sample_id, prediction_timestamp, completed_at và
target thành 24 cột.

## Quy tắc chống leakage

Mọi history dùng đúng điều kiện:

previous_job.completed_at < current_prediction_timestamp.

Job bắt đầu trước nhưng hoàn tất sau thời điểm dự đoán không được tính. Generator
dùng priority queue theo completion event cho cả overall, technician×issue và
technician×catalog. Không groupby toàn bộ dataset rồi expanding/backfill.
Preprocessing được fit bên trong từng temporal fold.

## Missing và cold start

Count bằng 0. Average/efficiency tương ứng giữ NaN; không gán standard hoặc 1.0
vì đó là bịa hiệu năng lịch sử. RF/XGBoost/HGB dùng median học từ train;
CatBoost giữ numeric NaN native. Category chưa thấy được encoder/pipeline xử lý.

## Chia dữ liệu và phê duyệt

Sort theo prediction_timestamp: 85% đầu là development, 15% cuối là final
holdout mới của V3. Chỉ development được dùng cho EDA, feature decision,
TimeSeriesSplit(n_splits=4), tuning và khóa winner. Holdout chỉ được đánh giá
sau khi winner đã khóa bằng CV MAE và near-tie policy.

## Ranh giới synthetic/real

Catalog V3 là master data tổng hợp có quan hệ hợp lý cho iPhone, iPad, MacBook,
Apple Watch và AirPods; không phải snapshot dữ liệu người dùng. Hidden
capability/specialty/complexity/noise/outlier chỉ sinh target và không xuất.
is_warranty không có multiplier kỹ thuật ẩn.

Phase tiếp theo mới xây extractor snapshot MySQL nhất quán, áp dụng grain,
target và history này, tạo dataset real versioned, chạy lại temporal validation
và yêu cầu phê duyệt trước mọi tích hợp runtime.
