# ML — Apple Repair Service

## Trạng thái Phase 1

Đây chỉ là bộ khung độc lập cho phase sau. Chưa có dataset, notebook thực nghiệm,
model, huấn luyện, FastAPI inference, HTTP client Spring Boot hoặc giao diện prediction.
Không thay đổi `ml_predictions` trong Phase 1.

## Cấu trúc

| Thư mục | Vai trò dự kiến |
|---|---|
| `notebooks/` | EDA, thử nghiệm regression/classification và đánh giá |
| `data/raw/` | Bản trích xuất dữ liệu đầu vào được cho phép sử dụng |
| `data/processed/` | Dataset sau preprocessing và feature engineering |
| `data/synthetic/` | Dữ liệu giả lập có nhãn nguồn rõ ràng cho phase sau |
| `src/` | Mã preprocessing, feature engineering, training/evaluation dùng lại |
| `models/` | Model artifact và metadata phiên bản sau khi huấn luyện |
| `api/` | FastAPI inference service trong phase sau |
| `tests/` | Test pipeline và API ML |

`data/` là dữ liệu phục vụ training, KHÔNG phải runtime business database.
Dataset và model artifacts mặc định bị gitignore. Không đưa thông tin khách hàng,
số điện thoại, tên, số sê-ri hoặc thông tin đăng nhập vào repository.

## Kiến trúc dự kiến

```text
React
  |
  v
Spring Boot
  |
  +--> MySQL
  |
  +--> Python FastAPI ML Service
```

**PHASE 1 CHƯA tích hợp Spring Boot với FastAPI.**

Spring Boot là backend chính, quản lý business rules, authorization, MySQL writes
và quyết định cuối cùng. Python sau này chỉ nhận feature, dự đoán và trả kết quả.
Python không trực tiếp update ticket, assign technician, update inventory,
thanh toán hoặc thay đổi business state. Khi ML lỗi, nghiệp vụ vẫn hoạt động.

## Môi trường dự kiến

Máy kiểm tra Phase 1 có Python 3.13.6. `requirements.txt` liệt kê dependency cần
cho classical supervised ML; chưa pin phiên bản vì chưa cài/kiểm chứng một bộ
môi trường training hoàn chỉnh. Phase 2 tạo virtualenv, kiểm tra tương thích rồi
khóa phiên bản đã kiểm chứng. Không cần TensorFlow/PyTorch.

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Các lệnh cài môi trường trên là hướng dẫn cho phase tiếp theo, chưa chạy ở Phase 1.

## Regression: active technical duration theo kỹ thuật viên

Target dự kiến: `actual_active_technical_minutes`.
Cùng một ticket có thể nhận ước lượng khác nhau cho từng kỹ thuật viên.

Không dùng `handedOverAt - receivedAt`. Cộng các khoảng `INSPECTING` và `REPAIRING`
từ `service_status_histories`, loại wait, queue, break, transfer gap và chờ bàn giao.
Với target theo người:

```text
intersection((INSPECTING + REPAIRING) intervals, technician assignment interval)
```

Đây là active technical duration theo state hợp lệ, chưa phải timer từng thao tác.
Giữ trạng thái active qua đêm vẫn tích lũy thời gian. Chưa có timer riêng từng repair item.
Chốt đơn vị mẫu trước training: ticket một kỹ thuật viên hay đóng góp theo assignment.
Không gán thời lượng toàn phiếu cho mọi kỹ thuật viên đã tham gia; thời gian đóng góp
của một người ở ca chuyển giao không đồng nghĩa thời gian người đó hoàn tất cả ca sửa.
Bản đầu nên đánh giá riêng các phiếu một kỹ thuật viên, lịch sử đầy đủ.

Nguồn: assignments, service_tickets, repair_items, service_status_histories,
service_catalog_items, device_models/device_types, service_issues/service_types,
parts, branches, technician_schedules. Kinh nghiệm/similar-job count được suy ra
chỉ từ lịch sử có trước thời điểm dự đoán; chưa cần technician_skill_profile.

ML chỉ dự đoán duration. Spring Boot sau này kết hợp prediction, schedule, workload,
remaining shift, role và business rules để đề xuất. Không tự biến cảnh báo thời gian
còn lại thành điều kiện bắt buộc ngăn phân công.

Fallback dự kiến duy nhất: tổng `standardDurationMinutes` của phương án kỹ thuật hiện tại.
Ticket mới không có duration catalog hợp lệ bị từ chối; không dùng giá trị 30/60 phút giả.
Prediction theo ứng viên cần hợp đồng lưu kèm technician/context trong phase sau;
Phase 1 không migrate ml_predictions.

## Classification: nguy cơ khách không hài lòng

Target: `dissatisfied = !service_feedbacks.satisfied`.
Prediction time phiên bản đầu: **WAITING_HANDOVER**, trước feedback.
Chỉ dùng thông tin đã tồn tại ở thời điểm đó: đặc điểm dịch vụ, thời gian sửa/chờ,
transfer đã chấp nhận, thay đổi phương án/giá, nguồn bảo hành đã biết.
Không dùng feedback/comment làm feature. Không gán khách chưa phản hồi là hài lòng.
Không dùng sự kiện quay lại bảo hành trong tương lai làm feature.
Chưa có promised deadline; không coi chênh lệch thời lượng ước tính là trễ cam kết.

ML chỉ cảnh báo rủi ro, không tự đổi ticket hoặc quyết định xử lý nhân viên.
Khi không có model/kết quả, trả “chưa có dự đoán”, không mặc định khách hài lòng.

## Điều kiện chuyển Phase 2

Chốt dataset contract, as-of timestamp, feature/target, quy tắc loại history thiếu,
quy tắc chuyển giao và tách train/test theo thời gian/phiếu. Đọc convention tại
`../docs/phase1/TEMPORAL_CONVENTIONS.md`.

Hiện chưa có lịch sử thực tế đủ để train/evaluate. Synthetic data chỉ phục vụ
kiểm thử pipeline/thử nghiệm và phải được đánh dấu; không chứng minh độ chính xác
vận hành. Không tự tạo dữ liệu synthetic hoặc model trong Phase 1.
