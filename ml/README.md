# ML v3: dự đoán thời gian sửa chữa theo kỹ thuật viên (KTV)

Thay thế hoàn toàn README cũ (bản cũ mô tả XGBoost cố định và quy trình v2, không còn đúng).

## Bài toán
Học có giám sát, **hồi quy**. Với một phiếu sửa chữa tại thời điểm lập hạng mục (t0) và một KTV ứng viên, dự đoán thời gian
thi công **thuần** (phút, đã trừ thời gian chờ linh kiện / chờ khách duyệt) kèm khoảng dự báo 90%. Hệ thống dùng để tính giờ
hoàn thành dự kiến và gợi ý KTV xong sớm nhất.

## Thuật toán (không cố định trước)
Bảy mô hình thi đấu công bằng: Ridge, Ridge log-nhân, Decision Tree, Random Forest, XGBoost, LightGBM, CatBoost, cùng 5 baseline.
Mô hình được chọn **bằng nested cross-validation** (CV-MAE nhỏ nhất), kiểm tra một lần trên tập test độc lập.
Tên mô hình thắng cuộc nằm trong `models/v2/repair_duration_bundle.joblib` (metadata) và `reports/metrics.json`.

## Cấu trúc
```
config/config.py            hằng số dùng chung (cột, seed, số fold, nguồn dữ liệu, cờ SYNTHETIC_DATA...)
src/features.py             làm sạch + RepairFeatureBuilder (tương thích scikit-learn Pipeline)
src/evaluation.py           chỉ số, baseline, trần nhiễu, ANCOVA, conformal
src/modeling.py             chia dữ liệu, mô hình ứng viên + lưới tham số, nested CV
src/bundle.py               đóng gói bundle, metadata, kiểm tra nạp lại
src/inference.py            nạp bundle, dự đoán, khoảng dự báo (dùng bởi API)
src/augment.py              sinh dữ liệu (chỉ dùng trong ablation Bước 13, mặc định không dùng)
scripts/seed_database_ml.py sinh dữ liệu mô phỏng vào MySQL (tham số mô phỏng công khai ở đầu file)
scripts/01_extract_raw_data.py   xuất CSV từ MySQL
scripts/02_audit_data.py         kiểm tra dữ liệu nhanh
scripts/03_train_evaluate.py     huấn luyện không đồ thị (cùng kết quả với notebook)
scripts/05_predict_demo.py       thử bundle không cần DB
scripts/06_db_service.py         dịch vụ dự đoán + ghi DB
scripts/07_monitor_feedback.py   giám sát sau triển khai
notebooks/model_selection.ipynb  quy trình đầy đủ 19 bước (Restart & Run All)
app.py                      API FastAPI (cổng 8001)
```

## Chạy
```
pip install -r requirements.txt
python scripts/seed_database_ml.py        # nếu cần sinh lại dữ liệu mô phỏng (N_PASSES trong file)
python scripts/01_extract_raw_data.py     # -> data/raw/raw_tickets_active.csv
python scripts/02_audit_data.py           # tùy chọn
# mở notebooks/model_selection.ipynb -> Restart Kernel & Run All  (sinh bundle + reports/)
python scripts/05_predict_demo.py
python app.py
```

## Quy tắc dữ liệu (quan trọng)
* `TICKET_CODE_PREFIX = "ST-SEED-"` trong `config/config.py`: chỉ huấn luyện trên phiếu do script seed sinh. Phiếu có mã khác
  (đợt sinh cũ, phiếu nhập tay) bị loại ở Bước 3 vì có quy luật khác. Đặt `None` khi dùng dữ liệu vận hành thật.
* `SYNTHETIC_DATA = True` cho đến khi huấn luyện bằng dữ liệu vận hành thật; API trả cờ này ra ngoài (`syntheticData`).
* `QUICK_MODE = False` cho kết quả báo cáo.

## Giới hạn đã biết
Dữ liệu là mô phỏng nên kết quả chứng minh quy trình, chưa chứng minh hiệu năng thực địa. Test chỉ đo dự đoán các loại phiếu đã gặp.
Chi tiết đầy đủ: `TAI_LIEU_HOC_MAY.md`.

## Dữ liệu mô phỏng và dữ liệu thật dùng chung một hệ thống
* `scripts/01_extract_raw_data.py` chỉ xuất phiếu có mã bắt đầu bằng `TICKET_CODE_PREFIX` (mặc định `ST-SEED-`), **không xóa gì trong DB**.
* Khi có dữ liệu thật: đặt `TICKET_CODE_PREFIX = None` và `SYNTHETIC_DATA = False` trong `config/config.py`, chỉ cần chạy `01` (không cần chạy seed) rồi chạy notebook.
