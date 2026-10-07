# Hướng dẫn demo data cách ly

Demo transaction chỉ nằm trong MySQL volume của Docker Compose với database mặc định `apple_repair_service_demo`. Không trỏ các script trong tài liệu này vào `localhost:3307/apple_repair_service`.

## Khởi tạo

1. Sao chép `.env.example` thành `.env` và thay mọi placeholder secret.
2. Chạy `docker compose up -d --build --wait`.
3. Backend profile `docker` tạo duy nhất admin bootstrap khi database mới và biến `BOOTSTRAP_ADMIN_ENABLED=true`.
4. Chạy:

```powershell
./scripts/seed-operational-data.ps1 -ApiBaseUrl http://127.0.0.1:8088 -AdminPassword '<demo-admin-password>' -OutputPath target/operational-data/demo-seed-summary.json
python scripts/seed-demo-state-matrix.py
```

`seed-operational-data.ps1` tạo master/staff/schedule qua API. `seed-demo-state-matrix.py` bị khóa mặc định vào `http://127.0.0.1:8088`, tạo transaction qua API nghiệp vụ và có marker deterministic để chạy lại không nhân đôi ma trận.

## Coverage đã xác minh

- Appointment: PENDING_CONFIRMATION, CONFIRMED, ARRIVED, CANCELLED, EXPIRED.
- Ticket: WAITING_ASSIGNMENT, ASSIGNED, INSPECTING, WAITING_APPROVAL, REPAIRING, WAITING_PART, WAITING_HANDOVER, HANDED_OVER.
- Có positive payment, warranty repair miễn phí với settle-zero, timing/history hợp lệ.
- Live E2E tạo stock-in, part usage, positive payment, handover và feedback.
- Nhiều assignment dùng nhiều KTV và candidate có workload/queue/ETA.

Kết quả hiện tại được ghi tại `target/operational-data/demo-state-matrix.json`. Các lần live E2E có thể để lại transaction trung gian trong demo volume; đây là database cách ly có chủ đích. Xóa/reset demo volume chỉ thực hiện khi người vận hành chủ động chấp nhận mất toàn bộ demo data, không dùng lệnh đó với canonical DB.

## Live test

```powershell
$env:LIVE_E2E='true'
cd frontend
npm.cmd run test:e2e:live
```

Suite không mock API. Nó tự tạo dữ liệu mang marker `LIVE-...`, đi từ booking đến feedback và chỉ chạy khi `LIVE_E2E=true`.

Fallback được kiểm tra bằng cách tạm dừng `ml`, chạy `python scripts/verify-ml-fallback.py`, xác nhận `ml_predictions=0`, rồi bật lại `ml`.
