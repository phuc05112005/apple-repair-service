# Quy tắc thời gian kỹ thuật và ETA

Tài liệu này là contract hiện hành sau Phase 1.2. Các báo cáo completion cũ chỉ ghi lại checkpoint lịch sử.

## Mốc và cấu hình

| Mốc | Ý nghĩa |
|---|---|
| `receivedAt` | Thời điểm tiếp nhận; không phải lúc bắt đầu kỹ thuật |
| `assignmentDueAt` | `receivedAt + UNASSIGNED_TICKET_TARGET_MINUTES`, mặc định 15 phút |
| `initialEstimatedStartAt` / `initialEstimatedCompletionAt` | Dự kiến tại lần tạo phiếu, không ghi đè |
| `estimatedStartAt` / `estimatedCompletionAt` | Dự kiến hiện tại sau sự kiện nghiệp vụ |
| `estimatedDurationMinutes` | Tổng thời lượng kỹ thuật mục tiêu của phương án hiện tại |
| `actualRepairStartedAt` | Lần đầu vào `INSPECTING`; không reset khi chờ, đổi phương án hoặc chuyển KTV |
| `actualRepairCompletedAt` | Lần đầu vào `WAITING_HANDOVER`; không dùng giờ bàn giao |

Chỉ còn hai cấu hình timing: `TECHNICIAN_BREAK_BETWEEN_JOBS_MINUTES` mặc định 10 và `UNASSIGNED_TICKET_TARGET_MINUTES` mặc định 15. Không có duration tạm cho phiếu chưa xác định dịch vụ. Phiếu mới luôn phải có dịch vụ và mọi catalog khả dụng phải có `standardDurationMinutes` dương.

## Active Technical Duration

Active Technical Duration là tổng các interval `INSPECTING` và `REPAIRING` hợp lệ. `INSPECTING` không có định mức riêng; nó là một phần của standard duration dịch vụ, cùng với sửa/thay, lắp lại và kiểm tra sau xử lý.

Không cộng `WAITING_APPROVAL`, `WAITING_PART`, queue wait, break, transfer gap, `WAITING_HANDOVER` hoặc khoảng KTV đang làm phiếu khác. Theo từng KTV, interval active được giao với interval Assignment của KTV đó. Backend khóa KTV và chặn bắt đầu/resume nếu KTV đang có một phiếu khác ở `INSPECTING` hoặc `REPAIRING`.

API giữ tên tương thích `completedRepairMinutes` và `currentRepairMinutes`, nhưng semantics của hai trường là active technical đã đóng và active technical hiện tại. UI không cộng hai trường với nhau.

## Target duration và đổi phương án

Target STANDARD cộng `standardDurationMinutes` của các hạng mục chưa bị `REJECTED`; phương án bảo hành thay thế dùng duration của catalog thay thế đã cấu hình. Warranty là context; technical method vẫn là `REPAIR` hoặc `REPLACEMENT`, không có warranty duration riêng.

```text
remaining = max(0, target technical duration hiện tại - accumulated active technical duration)
```

Đổi REPAIR sang REPLACEMENT hoặc ngược lại không reset elapsed. Thời gian chờ khách/linh kiện không trừ remaining. Ghi nhận wait resolved không đổi status và không tự resume; KTV chủ động tiếp tục khi không còn phiếu active khác.

Nếu toàn bộ phương án bị từ chối trong lúc chờ chọn phương án mới, hệ thống giữ target duration hợp lệ gần nhất để không bịa một giá trị thay thế. Phiếu mới không có catalog duration hợp lệ bị từ chối, không nhận fallback cố định.

## Queue, lịch làm và history

ETA dùng ca `WORKING` của KTV active trong 90 ngày, đúng chi nhánh, gộp ca trùng và mang remaining qua khoảng nghỉ/qua ngày. Phiếu active đứng trước; các phiếu còn lại FIFO theo `assignedAt` rồi ID. Phiếu chưa phân công được giữ chỗ dự kiến FIFO theo `receivedAt`/ID nhưng không tạo Assignment. Không có lịch phù hợp thì ETA start/completion là unknown.

Break chỉ là allowance giữa hai thiết bị, không phải active duration và không chặn KTV bắt đầu sớm. Các sự kiện tạo phiếu, phân công, bắt đầu, resume, đổi phương án, chờ, chuyển KTV, hoàn tất/hủy và manual ETA ghi snapshot phù hợp. Initial/history cũ được giữ; không backfill timestamp giả.

## ML readiness

Phase ML chưa được triển khai. Target regression tương lai là Active Technical Duration: `INSPECTING + REPAIRING`, giao với Assignment khi cần target theo KTV, loại toàn bộ wait/queue/break/transfer/handover wait. Predicted remaining sau này dùng cùng công thức remaining ở trên. Khi ML chưa có hoặc không dùng được, fallback duy nhất là tổng standard duration của catalog hiện tại; không có fallback 30 hoặc 60 phút.

## Kho linh kiện lỗi

PartUsage ACTIVE trừ usable stock và tạo `USAGE_OUT`. Warranty replacement bắt buộc PartUsage đúng catalog thay thế cùng mô tả thu hồi lỗi; `DefectivePartReturn` không cộng lại usable stock. Chuyển biên nhận lỗi sang `SENT_TO_SUPPLIER`, `RESOLVED` hoặc `DISPOSED` không sinh `STOCK_IN`/`USAGE_RETURN`.
