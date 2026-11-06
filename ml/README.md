# ML v2 — Dự đoán thời gian sửa chữa theo kỹ thuật viên

## 1. Bài toán (nói đúng trước hội đồng)
- **Học có giám sát, hồi quy**: dự đoán `net_repair_duration_minutes` (phút thi công thuần, đã trừ thời gian chờ linh kiện/duyệt).
- **Thuật toán**: Gradient Boosting Decision Trees (XGBoost). Chọn trên cơ sở: dữ liệu bảng, ít mẫu, quan hệ phi tuyến (giảm giá khi gộp nhiều dịch vụ, khác biệt theo KTV/thiết bị).
- **Thời điểm dự đoán**: sau khi phiếu có hạng mục sửa chữa và (với dự đoán theo KTV) đã biết KTV ứng viên. Mỗi lần hạng mục đổi, gọi lại `/predict-and-update`.
- **Dữ liệu**: mô phỏng theo quy luật nghiệp vụ (cold-start). API và báo cáo ghi rõ `syntheticData = true`.

## 2. Cấu trúc
```
ml/
  config/config.py            # MỘT nguồn cấu hình cho train + serve
  src/
    sql_features.py           # SQL gộp hạng mục: dùng chung 01 (train) và 06 (serve) -> hết lệch train/serve
    features.py               # làm sạch + RepairFeatureBuilder (thay cho preprocessor trong notebook)
    augment.py                # augmentation, mặc định TẮT
    evaluation.py             # chỉ số, baseline, bootstrap CI
    modeling.py               # tạo mô hình + fit/predict không rò rỉ
    inference.py              # nạp bundle, dự đoán, khoảng dự báo
  scripts/
    01_extract_raw_data.py    # DB -> data/raw/raw_tickets_active.csv
    02_audit_data.py          # kiểm tra: làm sạch, tín hiệu KTV (ANOVA), độ đa dạng
    03_train_evaluate.py      # tách test theo phiếu, baseline, CV, khoảng dự báo, bundle
    04_ablation_augmentation.py  # (tùy chọn) augmentation có ích không
    05_predict_demo.py        # thử dự đoán không cần DB
    06_db_service.py          # đặc trưng từ DB -> dự đoán -> ETA -> ghi DB
    07_monitor_feedback.py    # so dự đoán với thực tế sau triển khai
  app.py                      # FastAPI cho Spring Boot (giữ nguyên endpoint/JSON)
```

## 3. Quy trình chạy (theo thứ tự)
1. `pip install -r requirements.txt`
2. `python scripts/01_extract_raw_data.py`  (xuất lại CSV bằng SQL mới)
3. `python scripts/02_audit_data.py`        -> đọc kết luận KTV; nếu "KHÔNG có bằng chứng" thì sửa script sinh dữ liệu rồi quay lại bước 2
4. `python scripts/03_train_evaluate.py`    -> sinh `models/v2/*.joblib` và `reports/*`
5. `python scripts/04_ablation_augmentation.py` (tùy chọn)
6. `python scripts/05_predict_demo.py`
7. `uvicorn app:app --port 8001` hoặc `python app.py`
8. Định kỳ: `python scripts/07_monitor_feedback.py`

## 4. Những gì đã bỏ / sửa so với bản cũ
| Bản cũ | Vấn đề | Bản v2 |
|---|---|---|
| Chia train/test sau augment | Bản sao nhiễu ở cả hai tập | Tách test theo phiếu trước; augmentation mặc định tắt |
| Lọc Pearson < 0.005, `drop="first"` | Không hợp mô hình cây; gộp KTV/thiết bị gốc với "lạ" | Bỏ; one-hot đầy đủ, giá trị lạ -> 0 kèm cảnh báo |
| Preprocessor nằm trong notebook/`__main__` + `setattr` | Nạp lại dễ lỗi | Class trong `src/features.py`, một bundle |
| `total_parts_quantity_used` | Train = thực tế, serve = đoán (`COALESCE(...,1)`) | Bỏ khỏi đặc trưng |
| SQL serve join `part_usages` | Nhân dòng -> `SUM(duration)` phình | Dùng chung subquery với 01 |
| Không lọc REJECTED ở train | Lệch với serve | Cả hai cùng loại REJECTED |
| `tech_factor` theo ID | Con số bịa, mâu thuẫn với model | Xóa; KTV khác nhau chỉ khi dữ liệu có tín hiệu |
| `preprocessor.encoders[...]` | Mã chết (luôn vào `except`) | Xóa |
| `confidence = 0.9159` | Là R², không phải độ tin cậy | = mức phủ khoảng dự báo 90%; reason ghi khoảng |
| `syntheticData:false, productionValidated:true` | Sai sự thật | Lấy từ metadata (true/false) |
| Mỗi KTV: tải lại model + truy vấn lại | Chậm | 1 lần truy vấn, model nạp cache, tự nạp lại khi file đổi |
| Chọn "quán quân" theo chênh 0.04 phút | Chọn theo nhiễu | CV theo nhóm + chọn cấu hình đơn giản nhất trong nhóm hơn kém <1% |

## 5. Kiểm tra trước khi bật
- Mở `MlCandidateEstimateService` (Spring Boot): có đọc `syntheticData` / `productionValidated` / `featureContractVersion` để chặn hay không? Nếu chặn khi `syntheticData=true`, đó là chủ ý của hệ thống, đừng sửa cờ cho qua.
- Jackson phía Java phải chấp nhận các trường mới (`predictedLowerMinutes`, `predictedUpperMinutes`, `testMaeMinutes`...). Nếu không, bỏ các trường đó trong `app.py`.
- Cột `ml_predictions.confidence` phải nhận 0.90; `reason` của `service_time_estimate_histories` phải đủ ~250 ký tự.

## 6. Giới hạn cần nói thẳng
1. Dữ liệu là mô phỏng: mô hình chỉ học lại quy luật script sinh ra. MAE trên test đo độ khớp với quy luật đó, không phải hiệu năng vận hành thật.
2. Tối đa 3 KTV, 1 chi nhánh, 21 thiết bị, 7 loại lỗi; chi nhánh/KTV mới -> cảnh báo `UNKNOWN_*`.
3. Nhãn lấy từ phiếu đã hoàn tất (hạng mục cuối cùng); lúc dự đoán sớm có thể thiếu hạng mục phát sinh sau.
4. Chưa tính giờ làm việc/nghỉ trưa trong ETA (`break_minutes_snapshot = 0`).

## 7. Khi có dữ liệu thật
Đổi `RAW_DATA_PATH` sang dữ liệu vận hành, đặt `SYNTHETIC_DATA = False`, chạy lại 02 -> 03, so `reports/test_comparison.csv` với bảng baseline. Dùng `07_monitor_feedback.py` để quyết định khi nào train lại.
