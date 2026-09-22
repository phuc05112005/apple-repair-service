# Khởi tạo schema

`schema.sql` là schema canonical cho database **trống**: 29 bảng, có đủ lịch tuần,
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
