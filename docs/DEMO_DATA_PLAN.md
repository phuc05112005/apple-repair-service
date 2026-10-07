# Kế hoạch dữ liệu demo

## Trạng thái và giới hạn

Đây chỉ là **kế hoạch**. Phase hiện tại không seed database canonical `localhost:3307/apple_repair_service`, không chạy migration và không tạo dữ liệu giả trong database nghiệp vụ. Việc tạo demo data chỉ được thực hiện ở phase sau khi có yêu cầu riêng.

## Nguyên tắc tạo dữ liệu ở phase sau

- Dùng database demo/test riêng, tạo từ canonical schema 33 bảng.
- Prefix cố định `DEMO_202610_`; số điện thoại dùng dải giả `09000010xx`; serial, username, mã lô đều có prefix để truy vết và cleanup.
- Clock cố định theo `Asia/Ho_Chi_Minh`; lịch làm và slot bao phủ toàn bộ thời điểm kịch bản.
- Seed qua service/API công khai hoặc nội bộ khi cần chứng minh nghiệp vụ; chỉ seed master nền trực tiếp khi script đã được review.
- Không tắt foreign key, không `TRUNCATE`, không cascade lịch sử. Cleanup theo thứ tự phụ thuộc và chỉ xóa record mang prefix demo.
- ML scenario dùng runtime/artifact đang khóa; không retrain và không sửa feature contract.

## Master data tối thiểu

1. Hai chi nhánh ACTIVE.
2. Ba tài khoản: Admin, nhân viên tiếp nhận, hai kỹ thuật viên; lịch làm xác định.
3. iPhone 16 Pro với vấn đề pin/màn hình.
4. Catalog sửa chữa và thay thế, có duration/giá/bảo hành.
5. Hai linh kiện phù hợp, tồn kho đủ ở một chi nhánh và thiếu ở chi nhánh còn lại.
6. Weekly schedule, date override và slot OPEN cho ngày demo.
7. Settings timing, break và online discount có giá trị cố định được ghi vào manifest.

## Kịch bản deterministic

| ID | Kịch bản | Dữ liệu đầu vào | Trạng thái/kết quả cuối cần có |
|---|---|---|---|
| DD-01 | Online booking | Khách A, iPhone 16 Pro, pin, slot mở | Appointment `PENDING_CONFIRMATION`, hiển thị giá/ưu đãi backend |
| DD-02 | Walk-in | Khách B, máy chưa có appointment, mô tả triệu chứng | Ticket `WAITING_ASSIGNMENT`, có initial ETA |
| DD-03 | Repair | Ticket có hạng mục REPAIR và xác nhận DIRECT | Ticket `REPAIRING`, không yêu cầu part usage |
| DD-04 | Replacement | Ticket thay pin, tồn đủ | PartUsage ACTIVE, usable stock giảm đúng 1 |
| DD-05 | Waiting approval | Phương án phát sinh ngoài phạm vi | `WAITING_APPROVAL`, sau PHONE trở về `REPAIRING` |
| DD-06 | Waiting part | Chi nhánh thiếu linh kiện | `WAITING_PART`, sau nhập/chuyển kho và resume trở lại sửa |
| DD-07 | Transfer | KTV A đang nhận phiếu, KTV B hợp lệ | Transfer ACCEPTED, assignment A đóng, B mở |
| DD-08 | Warranty | Source item đã bàn giao và còn hạn | Claim liên kết source; remedy `REPAIR` hoặc `REPLACEMENT`; giá 0 |
| DD-09 | Payment | Phiếu hoàn tất có tổng dương | Payment `PAID`, sau đó `HANDED_OVER` |
| DD-10 | Feedback | Phiếu DD-09 đã bàn giao | Một feedback hợp lệ; phiếu chưa bàn giao bị từ chối |
| DD-11 | ML | Ticket/candidate có context được runtime hỗ trợ | Source `ML`, audit chỉ cho KTV được chọn, ETA refined |
| DD-12 | Fallback | Tắt hoặc cô lập ML service | Source `STANDARD_DURATION_FALLBACK`, assignment vẫn thành công, không audit ML giả |

## Thứ tự chạy đề xuất

Master/settings/schedules → inventory → online booking và arrival → intake/walk-in → recommendation/assignment → inspection/repair/wait/transfer → completion/payment/handover → warranty → feedback. Mỗi scenario ghi ID các row đã tạo vào manifest JSON để đối chiếu và cleanup.

## Tiêu chí chấp nhận ở phase demo

- Script chạy lặp lại trên database demo trống cho cùng kết quả.
- Mỗi scenario có assertion API và DB; không dùng UI-only deletion hay local state giả.
- Có snapshot row count/checksum trước và sau cho canonical DB để chứng minh không bị ghi.
- Cleanup database demo không chạm record ngoài prefix/manifest.
- Không dùng dữ liệu cá nhân thật, credential thật hoặc tuyên bố model đã production validated.
