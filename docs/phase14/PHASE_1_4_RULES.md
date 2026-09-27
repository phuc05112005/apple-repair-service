# Phase 1.4 — hardening lịch hẹn, phiên đăng nhập và UI nội bộ

- Check-in hợp lệ khi `slotStart <= arrivedAt < slotEnd`, dùng ngày lịch và múi giờ
  `Asia/Ho_Chi_Minh`. `arrivedAt` do backend ghi; trình duyệt chỉ hiển thị trạng thái
  tham khảo và backend luôn kiểm tra lại.
- Không còn grace period. Lịch chưa đến giờ trả `APPOINTMENT_TOO_EARLY`; tại hoặc sau
  cuối slot trả `APPOINTMENT_EXPIRED` và chuyển lịch sang EXPIRED.
- Discount trên Appointment tiếp tục là snapshot để audit. ServiceTicket chỉ nhận
  snapshot đó khi check-in hợp lệ; intake trực tiếp hoặc lịch không có bằng chứng
  check-in hợp lệ dùng discount 0.
- Reschedule thay AppointmentSlot nên lần check-in tiếp theo luôn dùng khoảng thời
  gian mới.
- Lịch tuần lưu draft đủ bảy ngày, hỗ trợ nhiều slot và copy toàn bộ trạng thái/slot.
  Backend và frontend cùng chặn khoảng rỗng, trùng hoặc chồng lấn.
- JWT nội bộ tồn tại trong `sessionStorage`, được xác minh lại qua `/auth/me` trước khi
  route guard quyết định điều hướng. Logout, token hết hạn hoặc 401 đều xóa phiên.
- Canonical schema vẫn có 32 bảng. Thay đổi schema duy nhất là cột nullable
  `appointments.arrived_at`; không triển khai ML.
