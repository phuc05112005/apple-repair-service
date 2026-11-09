# Hướng dẫn tích hợp học máy v3.1 (thay thế bản cũ)

**Cập nhật v3.1 (sau khi rà soát lần chạy đầu):** thêm lọc nguồn dữ liệu `TICKET_CODE_PREFIX`, so sánh trần nhiễu trên đúng tập phiếu, sửa vài câu in tự động, dịch lưới XGBoost/LightGBM, `N_PASSES=10`, README mới. Xem mục 0 bên dưới.

## 0. Việc phải làm sau rà soát (bắt buộc trước khi đưa số vào báo cáo)

Lần chạy đầu **trộn hai nguồn dữ liệu**: 408/1029 dòng có mã `ST-2026xx-...` (đợt sinh khác, KTV và nhiễu khác) cộng 621 dòng `ST-SEED-...`.
Vì vậy số liệu lần chạy đầu **không dùng được** cho báo cáo. Làm theo thứ tự:

1. Chép đè gói v3.1 (mục 1). Xóa `scripts/04_ablation_augmentation.py`, `data/synthetic/`, `repair_dataset_clean.csv` và các hình/CSV cũ trong `reports/` (README cũ được thay bằng README mới).
2. (Khuyến nghị) chạy lại `python scripts/seed_database_ml.py` với `N_PASSES = 10` để có khoảng 1.000 phiếu sạch một nguồn (script tự xóa phiếu `ST-SEED-` cũ).
3. `python scripts/01_extract_raw_data.py`, rồi mở notebook, **Restart & Run All**. Bước 3 sẽ in số phiếu nguồn khác bị loại.
4. Điền số mới vào `TAI_LIEU_HOC_MAY.md` mục 9 (Bảng điền số) và dùng đúng các con số đó trong báo cáo.

## 1. Thay file nào vào đâu

Giải nén `ml_v3.zip` đè lên thư mục `ml/` hiện tại (cùng cấu trúc).

| File | Việc cần làm |
|---|---|
| `notebooks/model_selection.ipynb` | **Thay mới hoàn toàn** (19 bước, 7 hình) |
| `config/config.py` | **Thay** (thêm nested CV, trần dữ liệu, bỏ `USE_AUGMENTATION`/`XGB_GRID`) |
| `src/features.py`, `src/evaluation.py`, `src/modeling.py`, `src/inference.py` | **Thay** |
| `src/bundle.py` | **Thêm mới** (đóng gói bundle dùng chung notebook và script 03) |
| `scripts/02_audit_data.py`, `03_train_evaluate.py`, `07_monitor_feedback.py` | **Thay** |
| `README.md` | **Thay** (bản cũ mô tả XGBoost cố định, không còn đúng) |
| `TAI_LIEU_HOC_MAY.md` | **Thêm mới** (tài liệu học máy đầy đủ) |
| `scripts/seed_database_ml.py` | **Thay (tùy chọn, xem mục 3)** |
| `src/augment.py`, `src/sql_features.py`, `scripts/01`, `05`, `06`, `app.py`, `requirements.txt` | **Giữ nguyên** (không đổi, không cần chép) |
| `scripts/04_ablation_augmentation.py` | **Xóa** (ablation đã nằm trong Bước 13 của notebook) |
| `reports/*.png`, `reports/*.csv`, `models/v2/*.joblib` cũ | **Xóa** (sẽ được sinh lại; bundle cũ có thể không khớp định dạng mới) |

## 2. Chạy thế nào

```
cd ml
pip install -r requirements.txt
python scripts/01_extract_raw_data.py        # xuất CSV từ MySQL (bỏ qua nếu đã có data/raw/raw_tickets_active.csv)
python scripts/02_audit_data.py              # tùy chọn: kiểm tra dữ liệu nhanh
# mở notebooks/model_selection.ipynb -> Restart Kernel & Run All  => sinh models/v2/repair_duration_bundle.joblib
python scripts/05_predict_demo.py            # thử bundle không cần DB
python app.py                                # chạy API (cổng 8001), tự nạp bundle mới
```

* `QUICK_MODE=False` (mặc định) cho kết quả báo cáo; chỉ đặt `True` để chạy thử nhanh.
* Có thể huấn luyện lại không cần notebook bằng `python scripts/03_train_evaluate.py`: cùng hàm, cùng seed nên **ra cùng mô hình** với notebook.
* `app.py`, `06_db_service.py` không đổi: bundle mới giữ nguyên các khóa metadata mà API đọc (`model_name`, `model_version`, `synthetic_data`, `test_metrics`, `interval_halfwidth_minutes`, `interval_coverage`).
* Thời gian chạy notebook: vài phút (khoảng 1.000 phiếu) đến vài chục phút (vài nghìn phiếu), chủ yếu do nested CV.

## 3. Về dữ liệu (quan trọng nhất cho báo cáo)

Bản `seed_database_ml.py` bạn gửi **không thể** sinh ra bộ CSV cũ (832 phiếu, MAE test 2,11):
nhiễu lognormal σ=0,25 làm MAE tối thiểu cỡ vài phút, và script sinh ~4.500 phiếu chứ không phải 832.
Ngoài ra script cũ cộng phút "chờ duyệt / chờ linh kiện" vào thời gian sửa mà **không ghi lịch sử chờ**, nên nhãn "thời gian thuần" bị nhiễu không thể học, và script không đặt seed nên mỗi lần chạy ra một bộ khác.

Bản mới sửa: đặt seed, tham số mô phỏng công khai ở đầu file, ghi lịch sử chờ để nhãn thuần đúng nghĩa (tự bỏ kịch bản chờ nếu schema không cho ghi), KTV nào cũng nhận cả ca khó lẫn ca thường.
**Script này chưa được chạy thử trên MySQL của bạn** (tôi không có DB); chạy xong hãy chạy `02_audit_data.py` để kiểm tra.

Điều bắt buộc: báo cáo phải mô tả **đúng script đã sinh ra đúng CSV dùng để huấn luyện**. Nếu bạn giữ CSV cũ mà không rõ nguồn, đừng nêu nguồn gốc cụ thể.
Chạy lại với dữ liệu mới thì **mọi con số đổi** (MAE, R², hệ số KTV, độ phủ); điều đó là bình thường. Số cũ trong tài liệu giải thích cũ không còn dùng được.

## 4. Những sai sót của bản cũ đã sửa

| # | Sai sót / thiếu sót | Cách sửa |
|---|---|---|
| 1 | CV-MAE của cấu hình tốt nhất tính trên chính các fold dùng để chọn tham số (lạc quan) | **Nested CV**: vòng trong chọn tham số, vòng ngoài đánh giá |
| 2 | Bộ mã hóa fit trên toàn train rồi mới CV (tài liệu cũ lại nói "fit trong từng fold") | Mô hình là `Pipeline(builder → mô hình)`: builder fit lại trong từng fold thật sự |
| 3 | EDA chạy trên **toàn bộ dữ liệu trước khi tách test** | Tách train/test trước; EDA chỉ trên train |
| 4 | Mốc so sánh là B3 (yếu), nên "giảm 74%" là so với mốc yếu; lời ở cell cũ gọi B3 là "đáng gờm nhất" | Baseline mạnh nhất **chọn bằng CV** và dùng làm mốc; thêm baseline "định mức × hệ số KTV" (mô hình nhân đơn giản) |
| 5 | Tên mô hình bị nhân đôi do chạy lại cell (`cv_rows.append`) | Kết quả gán theo khóa: chạy lại bao nhiêu lần cũng không trùng |
| 6 | ANOVA thô về tín hiệu KTV bị nhiễu bởi việc phân ca không ngẫu nhiên | Thêm **ANCOVA** (F-test từng phần, hiệu chỉnh độ khó ca) và Kruskal–Wallis |
| 7 | Huấn luyện bằng bình phương sai số nhưng KPI là MAE, nhãn lệch phải | Hàm mất mát tuyệt đối nằm trong lưới của XGBoost/LightGBM/CatBoost; thêm Ridge log-nhân |
| 8 | Khoảng dự báo độ rộng cố định dù nhiễu tăng theo độ dài ca | Chọn **absolute hay relative** bằng dữ liệu hiệu chuẩn (không nhìn test); báo cáo độ phủ theo từng nhóm ca |
| 9 | Phần dư conformal lấy từ OOF của tham số đã chọn trên chính dữ liệu đó | Dùng OOF của nested CV |
| 10 | Không có thước đo "tối đa đạt được" nên không phát hiện được số quá đẹp | **Trần nhiễu (pure error)** từ phiếu song sinh |
| 11 | Ablation augmentation dùng cả dữ liệu test | Ablation chỉ chạy bên trong train |
| 12 | `scripts/03` cố định XGBoost, có thể lệch notebook | Cùng hàm trong `src/`, chạy cùng pipeline |
| 13 | Lưới XGBoost có cấu hình thắng nằm ở biên (max_depth=3) | Mở rộng lưới (độ sâu 2 đến 6, thêm hàm mất mát) |
| 14 | Quá nhiều hình ít giá trị (50+ cell) | 45 cell, 7 hình; bỏ sơ đồ 10 ô, đếm cột đặc trưng, ma trận tương quan, PDP, Q-Q... |

## 5. Những câu phải nói đúng khi báo cáo

* "Dữ liệu là **mô phỏng có kiểm soát**; kết quả chứng minh quy trình, chưa chứng minh hiệu năng thực địa."
* Mô hình được chọn "theo CV-MAE nhỏ nhất (nested CV)". Nếu notebook in cảnh báo "nhiều mô hình hòa thống kê" thì **không** nói "vượt trội".
* Mức cải thiện luôn tính so với **baseline mạnh nhất theo CV** (notebook in sẵn), kèm CI. Nếu cảnh báo "không hơn baseline mạnh nhất" xuất hiện, phải nói thẳng điều đó.
* Test chỉ đo dự đoán các loại phiếu đã gặp (phiếu "song sinh" có thể ở cả train và test); chưa đo dịch vụ/đời máy mới.
* Cột `confidence` = 0,90 là mức phủ danh nghĩa của khoảng dự báo, không phải độ chính xác.
