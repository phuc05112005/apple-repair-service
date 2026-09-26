# Quy tắc thời gian và kho linh kiện lỗi — Phase 1.1

## Các mốc và cấu hình

| Mốc | Ý nghĩa |
|---|---|
| receivedAt | Tiếp nhận thiết bị; không phải bắt đầu sửa |
| assignmentDueAt | receivedAt + UNASSIGNED_TICKET_TARGET_MINUTES (mặc định 15) |
| assignedAt | Mốc trong Assignment hiện có |
| initialEstimatedStartAt / initialEstimatedCompletionAt | Dự kiến tại đúng lần tạo phiếu; không sửa lại |
| estimatedStartAt / estimatedCompletionAt | Dự kiến hiện tại sau các sự kiện nghiệp vụ |
| estimatedDurationMinutes | Tổng thời lượng sửa ước tính, không cộng break hoặc waiting |
| actualRepairStartedAt | Lần đầu vào REPAIRING; không reset khi chờ hoặc chuyển KTV |
| actualRepairCompletedAt | Lần đầu vào WAITING_HANDOVER; không dùng giờ bàn giao |

`TECHNICIAN_BREAK_BETWEEN_JOBS_MINUTES` mặc định 10, cho phép 0–10080.
`UNASSIGNED_TICKET_TARGET_MINUTES` mặc định 15, cho phép 0–10080.
`DEFAULT_INSPECTION_ESTIMATE_MINUTES` mặc định 30, cho phép 1–10080.
API yêu cầu số nguyên. Mặc định được đọc tập trung; không tự INSERT setting.
Đổi cấu hình chỉ ảnh hưởng các lần tính sau. History giữ break snapshot cũ.

## Từ tiếp nhận đến hàng đợi

Thời lượng STANDARD cộng standardDurationMinutes dương của các hạng mục APPROVED
có catalog ACTIVE. Thay bảo hành dùng catalog thay bảo hành. Không tính hạng mục
REJECTED/PENDING. Chưa có tổng thời lượng hữu ích thì dùng default inspection.

Tính lịch trong 90 ngày tới từ các ca WORKING của tài khoản TECHNICIAN ACTIVE.
Gộp ca trùng nhau, chỉ dùng ca tại chi nhánh của phiếu, chuyển phần việc còn lại
qua khoảng nghỉ/qua ngày. Không có lịch phù hợp: trả dự kiến chưa xác định và
vẫn giữ thời lượng/hạn phân công; không bịa ca làm việc.

Phiếu có KTV: REPAIRING đứng trước, các phiếu còn lại FIFO theo assignedAt rồi ID.
WAITING_PART/WAITING_APPROVAL không giữ thời gian làm việc. Phiếu chưa phân công
được dự kiến FIFO theo receivedAt/ID, chọn KTV có giờ hoàn thành khả thi sớm nhất;
KTV ID giải quyết trường hợp bằng nhau. Đây chỉ là giữ chỗ dự kiến, không tạo
Assignment hoặc đổi thuật toán gợi ý phân công hiện có.

Remaining = max(0, estimatedDurationMinutes − currentRepairMinutes).
currentRepairMinutes đã gồm khoảng đóng và khoảng REPAIRING đang mở. Không cộng
completedRepairMinutes thêm lần nữa. Break là khoảng thời gian lịch giữa hai
thiết bị; được đặt sau completion dự kiến hoặc completion thực tế gần nhất.
KTV có thể bắt đầu trước khi hết break: actual start luôn lấy thời gian hành động.

## Các sự kiện tính lại và lịch sử

Tạo phiếu, phân công, vào kiểm tra, vào REPAIRING, resume, đổi phương án/giải pháp
bảo hành, chờ linh kiện/khách, chuyển giao, hoàn tất/hủy và chỉnh ETA thủ công đều
được tính trong transaction nghiệp vụ. Khi phiếu đang chạy không phải đối tượng
của sự kiện, giữ deadline cũ của nó để vẫn thấy overdue; dùng remaining cập nhật
để tính hàng đợi phía sau. Hoàn tất giữ nguyên ETA của phiếu vừa xong và đẩy/kéo
hàng đợi tiếp theo theo giờ hoàn tất thật. Bàn giao không tạo thêm thời lượng sửa.

Waiting có current ETA null vì chưa biết lúc nào đủ điều kiện tiếp tục. Initial
và history không mất. Khi resume dùng remaining, không lặp lại toàn duration.

Mỗi sự kiện trực tiếp ghi snapshot; phiếu bị ảnh hưởng trong hàng đợi ghi khi
estimate thực sự đổi. History gồm technician nếu có assignment hiện tại,
STANDARD/MANUAL, lý do, người thực hiện nếu được truyền vào, thời điểm, break và
snapshot tổng giá APPROVED. Tính tự động do quyết định bảo hành dùng actor null;
không giả danh người tạo phiếu. Snapshot terminal có thể không có technician vì
assignment đã kết thúc; có thể nối lại bằng lịch sử Assignment.

MANUAL yêu cầu quyền Admin/nhân viên tiếp nhận và lý do. Giờ hoàn tất phải trong
tương lai và không trước giờ bắt đầu. Giá trị hiện tại/duration được lưu; các sự
kiện vận hành tiếp theo vẫn có thể tính lại queue. Đổi phương án trở về STANDARD.
MANUAL không thay đổi trạng thái, actual timestamps hoặc dữ liệu initial.

## Chỉ số đọc

`GET /api/v1/internal/service-tickets/{id}/timing-metrics` dùng quyền đọc phiếu.
Có assignment wait, queue wait (khoảng ASSIGNED trước actual start), start delay
so với initial, estimated/actual repair, completion delay so initial/current,
waiting part/approval, accepted transfers, số snapshot đổi phương án, thay đổi
giá APPROVED đầu/cuối và active minutes theo KTV.

Active theo KTV = giao giữa REPAIRING intervals và Assignment intervals; cộng
seconds trước khi chuyển minutes. Chỉ số delay không âm. Không tự gán nhãn hài
lòng/không hài lòng. Lịch sử thiếu hoặc đứt đoạn cho active/waiting unknown với
completeStatusHistory=false, không giả là đo được 0. Giá có null không bị đổi
thành 0. Snapshot giá là ngữ cảnh phương án, không thay thế chứng từ thanh toán.

## Giao diện

Helper chung trả xanh khi còn nhiều thời gian, vàng khi còn <= max(15 phút,
ceil(20% estimated duration)), đỏ khi đã quá hạn. Có chữ trạng thái bên cạnh màu.
Hạn đúng 0 phút vẫn vàng, sau hạn mới đỏ. Countdown dùng timestamp tuyệt đối và
đồng hồ trình duyệt cập nhật 15 giây/lần. Không có status thời gian trong DB.

Nhân viên tiếp nhận thấy cảnh báo chưa phân công, ETA và thứ tự ưu tiên chú ý.
KTV thấy thứ tự công việc không tính phiếu tạm chờ. Chi tiết giữ initial/current/
actual và lịch sử. Khi assignment kết thúc, giữ policy cũ: KTV không đọc lại
lịch sử qua API, Admin/nhân viên tiếp nhận vẫn tra cứu được.

## Kho lỗi

PartUsage ACTIVE trừ usable stock và tạo USAGE_OUT như cũ. Có thu hồi thực tế thì
cùng transaction tạo DefectivePartReturn; warranty replacement bắt buộc mô tả.
Normal replacement không chọn thu hồi thì không tạo biên nhận. Unique source usage
chặn hai biên nhận cho cùng lần sử dụng; gọi record lại trả biên nhận có sẵn nếu
part/quantity khớp. Đây không phải idempotency key cho hai lệnh xuất kho độc lập.

partId trên biên nhận là linh kiện tháo ra. API cho truyền defectivePartId; mặc
định lấy part của hạng mục bảo hành gốc nếu có, nếu không lấy part đang thay
(quy ước thay cùng loại). UI hiện ghi theo mặc định này; mã/đặc điểm cụ thể lưu
trong mô tả. Trường hợp tháo một mã linh kiện khác cần truyền ID phù hợp qua API.

Tồn kho lỗi = SUM(quantity) theo branch+part và status IN_STOCK. Chuyển trạng thái
sang SENT_TO_SUPPLIER/RESOLVED/DISPOSED không sinh STOCK_IN hoặc USAGE_RETURN.
RESOLVED/DISPOSED kết thúc biên nhận. Thay đổi lưu người, giờ và ghi chú nối tiếp;
chưa có bảng lịch sử logistics riêng. Không được xuất kho lỗi cho phiếu khác.

## Giới hạn vận hành

ETA là ước lượng theo ca và trạng thái ticket, không phải timer thao tác từng item.
Không tự phát hiện thời gian thực tế KTV làm nhiều việc đồng thời. Bộ tính đọc
batch các phiếu/assignment đang mở trên hệ thống, chưa có phân trang/partition
queue cho quy mô lớn. Chưa benchmark tải lớn hoặc kiểm thử đa instance.
Các transaction sử dụng khóa nghiệp vụ hiện có; không thêm scheduler cập nhật
ETA mỗi phút. Đồng hồ trình duyệt cần đúng để countdown hiển thị đúng.

Phiếu cũ không có initial/history vẫn null. Không backfill giả kho lỗi từ note cũ.
Không có ML runtime, customer online approval, appointment capacity hoặc autoassign.
