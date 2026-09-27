# Phase 1.3 — service, timing, warranty và cấu hình

Đây là contract nghiệp vụ hiện hành. Phase này không triển khai ML.

- Phiếu mới luôn có ít nhất một dịch vụ catalog. Walk-in rỗng bị từ chối.
- Catalog khả dụng có standard duration dương. Không còn setting hoặc fallback duration 30 phút.
- Active Technical Duration là `INSPECTING + REPAIRING`, loại wait/queue/break/transfer gap/handover wait. Một KTV chỉ có một phiếu active technical.
- Đổi phương án không reset elapsed; remaining = `max(0, target mới - active technical đã tích lũy)`.
- Warranty là context. Technical remedy là REPAIR hoặc REPLACEMENT theo cấu hình dịch vụ nguồn. Claim mới liên kết về RepairItem nguồn, giữ nguyên kỳ bảo hành và không có claim counter nhập tay.
- Nhân viên tiếp nhận tra cứu lịch sử bằng số điện thoại hoặc mã phiếu và tạo phiếu bảo hành từ hạng mục còn hiệu lực.
- `ONLINE_BOOKING_DISCOUNT_PERCENT` nằm trong `system_settings`, mặc định 10, hợp lệ 0–100. Appointment và từng giá dịch vụ chụp snapshot khi đặt.
- Canonical schema có 32 bảng. Phase này chỉ thêm hai field cấu hình trên `service_catalog_items`; không thêm bảng và không cascade delete.

Migration additive tham khảo: [phase13-additive.sql](../../database/phase13-additive.sql). Không chạy canonical schema hoặc additive script máy móc lên database có dữ liệu; phải kiểm tra duration null và schema thực tế trước.
