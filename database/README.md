# Khởi tạo schema

`schema.sql` là schema canonical cho database **trống**: 33 bảng, có đủ lịch tuần,
ngày ngoại lệ, mapping issue–device type và các trường Phase 1:
- `service_tickets.customer_reported_issue`, `authorized_scope` (TEXT nullable).
- `repair_items.confirmation_method` (DIRECT/PHONE/PRE_AUTHORIZED), `warranty_remedy`
  (REPAIR/REPLACEMENT), `warranty_replacement_catalog_id` (nullable FK).
- `part_usages.defective_return_note` (TEXT nullable). Có nội dung nghĩa là lần thay
  này đã thu hồi cùng số lượng linh kiện lỗi, với người/thời điểm của PartUsage;
  bản ghi không đại diện cho hàng có thể sử dụng trong BranchInventory.
File không có seed dữ liệu, DROP/DELETE/TRUNCATE hay tắt foreign key checks.
Các bảng được tạo trước rồi mới thêm FK để giải quyết quan hệ vòng giữa booking,
phiếu và nguồn bảo hành. Giữ ENUM và các relationship hiện tại.

Không import file này lên database có dữ liệu. Database local đang dùng ddl-auto=update:
Hibernate bổ sung các cột nullable/FK mới khi khởi động bản mới; không có
backfill giả cho phiếu cũ. Nếu dùng ddl-auto=validate, quản trị viên áp dụng thay đổi
additive theo schema trước khi chạy. Phase 1 không chạy migration lên database người dùng.

Tests mặc định trỏ `apple_repair_service_test`, không dùng database nghiệp vụ.
Tạo một database test riêng, import schema vào database trống đó rồi đặt
`SPRING_DATASOURCE_URL` hoặc `TEST_DATABASE_URL` khi chạy Maven. Các test transaction
rollback; test concurrency/HTTP commit tự cleanup đúng fixture trong database test.
Không chạy các test này với URL database chứa dữ liệu người dùng.

## Phase 1.1 — kho lỗi và thời gian dự kiến

Thêm `defective_part_returns` và `service_time_estimate_histories`. `service_tickets`
nhận 9 cột nullable: hạn phân công, dự kiến bắt đầu/hoàn thành ban đầu và hiện tại,
ngày bắt đầu/hoàn thành sửa thực tế, thời lượng dự kiến và nguồn dự kiến.

`phase11-additive.sql` dành cho database đã có schema Phase 1, chạy **một lần** khi
chưa có các cột/bảng tương ứng. Script được cung cấp để quản trị viên áp dụng; lượt
này không thực thi trên database nghiệp vụ. Nếu Hibernate đã tạo cột/bảng thì cần
đối chiếu schema trước, không chạy lại script nguyên khối. MySQL DDL có implicit
commit; nên sao lưu và áp dụng khi ngừng ghi nghiệp vụ theo quy trình triển khai.

Không suy diễn defective quantity từ các note cũ. Biên nhận mới là nguồn số lượng
kho lỗi. Không sinh ETA ban đầu giả cho ticket cũ. Các lần tính trong tương lai
có thể ghi current ETA/history thật từ thời điểm tính, còn initial ETA vẫn null.

Mặc định tập trung khi chưa có setting: nghỉ 10 phút và hạn phân công 15 phút.
Không có thời lượng tạm cho phiếu thiếu dịch vụ; catalog phải có duration dương.
Admin lưu cấu hình sẽ dùng API system_settings hiện có.

Quy tắc: [SERVICE_TIMING_RULES.md](../docs/phase11/SERVICE_TIMING_RULES.md).

## Phase 1.2 — lô nhập kho và điều kiện chờ đã giải quyết

Thêm duy nhất bảng `inventory_lots`. Một lần nhập kho mới tạo InventoryLot, tăng
BranchInventory và tạo InventoryTransaction STOCK_IN có `inventory_lot_id` trong
cùng transaction. InventoryLot chỉ lưu nguồn gốc và số lượng ban đầu; không có
remaining quantity. BranchInventory tiếp tục là nguồn tồn usable hiện tại.

`service_status_histories` lưu `resolved_at`, `resolution_recorded_at`, người và
ghi chú giải quyết điều kiện chờ. `repair_items.approval_resolved_at` lưu giờ khách
thực tế phản hồi, tách khỏi giờ nhân viên nhập dữ liệu. Transfer bổ sung công việc
đã làm, tình trạng thiết bị và ghi chú phản hồi; các cột mới nullable để không bịa
dữ liệu lịch sử cũ, còn API mới bắt buộc nội dung khi tạo yêu cầu chuyển giao.

`phase12-additive.sql` dành cho schema Phase 1.1 chưa có các thay đổi trên. Chỉ áp
dụng một lần sau khi đối chiếu schema; không import `schema.sql` vào database đã có
dữ liệu và không tự backfill nguồn lô/thời điểm chờ/chuyển giao cho lịch sử cũ.

## Phase hiện tại — warranty configuration và duration bắt buộc

`service_catalog_items` thêm nullable `warranty_remedy` và self-FK
`warranty_replacement_catalog_id`. Không thêm bảng claim: các lần bảo hành được derive
từ `repair_items.warranty_source_item_id`. `standard_duration_minutes` là bắt buộc cho
catalog mới và canonical schema.

`phase13-additive.sql` chỉ dành cho schema Phase 1.2 sau khi quản trị viên đã đối chiếu
và xử lý có chủ đích mọi duration legacy null. Script không tự điền 30 phút và không
được import thay canonical schema vào database đang có dữ liệu.

## Phase 1.4 — check-in lịch hẹn theo thời gian server

`appointments.arrived_at` lưu thời điểm backend thực tế chấp nhận thao tác “Khách đã
đến”. `phase14-additive.sql` chỉ thêm cột nullable này; không xóa key grace cũ trong
`system_settings` và không sửa snapshot ưu đãi của lịch hẹn. Bản ghi lịch sử ARRIVED
không có `arrived_at` được xem là không đủ bằng chứng áp dụng ưu đãi khi tạo phiếu mới.

## Phase 1.5 — prediction thời lượng theo ứng viên kỹ thuật viên

`ml_predictions.technician_id` là FK nullable đến `users.id`, không cascade delete.
Đây là kỹ thuật viên ứng viên tùy chọn gắn với prediction, chủ yếu dùng cho
`REPAIR_DURATION` theo từng kỹ thuật viên. Giá trị có thể null với prediction cấp
ticket như `CUSTOMER_SATISFACTION` hoặc bản ghi legacy.

> Optional technician candidate associated with a prediction. Primarily used for
> technician-specific REPAIR_DURATION predictions. May be null for ticket-level
> predictions such as CUSTOMER_SATISFACTION or legacy records.

`phase15-additive.sql` chỉ thêm cột nullable, FK và index
`(technician_id, prediction_type, predicted_at)`. Script không cập nhật prediction
cũ, không thay `service_catalog_items.standard_duration_minutes`, không tạo bảng và
không được import thay canonical schema vào database đang có dữ liệu.

## Phase 1.6 — khoảng gián đoạn kỹ thuật

Thêm duy nhất bảng `service_interruptions`, nối tới `assignments.id` và `users.id`
qua `recorded_by`. Từ assignment có thể truy ngược ticket, kỹ thuật viên và chi nhánh;
bảng không lặp lại `service_ticket_id`, `technician_id` hoặc `branch_id`.

Mỗi bản ghi lưu khoảng bắt đầu/kết thúc, nguyên nhân, phạm vi trách nhiệm, nguồn ghi
nhận, trạng thái xác minh và optional `incident_group_code` để nhóm các gián đoạn cùng
sự kiện. CHECK constraint chặn `ended_at < started_at`; hai FK dùng RESTRICT/NO ACTION
theo mặc định MySQL, không cascade xóa lịch sử.

`phase16-additive.sql` tạo bảng mới trên schema Phase 1.5. Script chỉ được áp dụng một
lần sau khi đối chiếu target schema; không import lại `schema.sql`, không reset database
và không backfill gián đoạn giả cho lịch sử cũ. Phase này chỉ chuẩn bị schema/JPA
mapping, chưa có API/UI và chưa tự động trừ interruption khỏi duration hoặc target ML.
