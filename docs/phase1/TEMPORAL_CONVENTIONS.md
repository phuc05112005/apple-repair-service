# Quy ước ngày giờ — Phase 1

- Múi giờ nghiệp vụ cố định: `Asia/Ho_Chi_Minh` (UTC+7).
- `TimeConfig` cung cấp Clock ở múi giờ này và đồng bộ JVM default để các trường
  Hibernate `@CreationTimestamp`/`@UpdateTimestamp` LocalDateTime dùng cùng quy ước.
- Appointment slot date, ngày ca làm, weekly weekday, date override và ngày bảo hành
  là ngày lịch nghiệp vụ (`LocalDate` / `YYYY-MM-DD`). Truyền nguyên chuỗi ngày giữa
  input, API và MySQL DATE; không chuyển ngày đó thành Instant/UTC.
- Status `changedAt`, assignment `assignedAt`/`endedAt`, received/paid/handover timestamps
  tiếp tục là LocalDateTime/MySQL DATETIME theo giờ Việt Nam. Không đổi nghĩa dữ liệu
  cũ hay migrate lịch sử. API trả chuỗi local datetime không offset như contract hiện tại.
- JWT expiration và error timestamp là Instant (UTC có Z); giữ nguyên semantics này.
- Frontend `businessDate()` lấy ngày hiện tại tại UTC+7, độc lập timezone trình duyệt.
  `addBusinessDays()` làm phép toán lịch trên chuỗi DATE. `formatDateTime()` diễn giải
  datetime không offset là UTC+7, giữ instant có offset rồi hiển thị giờ Việt Nam.
- Không dùng `new Date().toISOString().slice(0, 10)` để khởi tạo ngày nghiệp vụ.
- RepairDurationService cộng các khoảng REPAIRING trên cùng convention, loại các
  trạng thái chờ. `completedRepairMinutes` = tổng các khoảng đã đóng;
  `currentRepairMinutes` = tổng trên + khoảng REPAIRING đang mở. UI chỉ hiển thị
  currentRepairMinutes, không cộng hai trường.
- Dữ liệu cũ từ timezone khác (nếu có) cần xác minh nguồn trước khi làm dataset;
  Phase 1 không tự suy đoán/chuyển đổi hàng loạt các timestamp cũ.

Test: BusinessTimeTest và frontend/tests/business-time.test.mjs bao gồm 23:59:59 →
00:00:00 giờ Việt Nam, trình duyệt UTC/UTC+7/Los Angeles, đổi tháng/năm và lịch sử
REPAIRING qua nửa đêm (completed=20, current=25).

## Bổ sung Phase 1.1

Các cột ETA/deadline/actual dùng LocalDateTime theo Asia/Ho_Chi_Minh, giống receivedAt.
`actualRepairStartedAt` ghi lần đầu vào REPAIRING; resume không reset. Hoàn tất kỹ
thuật là WAITING_HANDOVER; bàn giao không kéo dài thời gian sửa. ETA history là
snapshot append-only theo thời gian tính, không phải thời gian trạng thái.

Countdown chỉ tính trên trình duyệt mỗi 15 giây, không ghi database hoặc gọi API
định kỳ. Timestamp không offset được diễn giải +07:00. Các ca tích hợp Phase 1.1
chạy với JVM khởi tạo UTC và đồng hồ kiểm thử theo Việt Nam.

Chi tiết tại [quy tắc thời gian](../phase11/SERVICE_TIMING_RULES.md).
