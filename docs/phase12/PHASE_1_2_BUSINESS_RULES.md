# Quy tắc nghiệp vụ Phase 1.2

## Kho linh kiện

- Part là danh mục; InventoryLot là nguồn gốc một lần nhập; BranchInventory là tồn usable hiện tại.
- Nhập kho: tạo lot → tăng tồn → ghi STOCK_IN có lot, cùng một transaction.
- Xuất/chuyển kho không âm và không có cập nhật trực tiếp quantity từ UI.
- PartUsage tạo USAGE_OUT; reverse hợp lệ tạo USAGE_RETURN đúng một lần.
- DefectivePartReturn không cộng vào usable stock và không tạo STOCK_IN.

## Trạng thái kỹ thuật viên

- UI/API cung cấp hành động nghiệp vụ, không cung cấp dropdown ghi raw status.
- WAITING_PART và WAITING_APPROVAL chỉ chuyển lại REPAIRING sau khi điều kiện chờ đã được ghi nhận kết thúc và KTV chủ động resume.
- Ghi nhận khách đồng ý/từ chối không tự resume và không preempt phiếu đang active technical.
- Một KTV có thể có nhiều assignment mở nhưng chỉ một ticket ở `INSPECTING` hoặc `REPAIRING`.
- resolvedAt là giờ thực tế; recordedAt là giờ hệ thống ghi nhận. Giá trị thực tế phải nằm trong khoảng bắt đầu chờ đến hiện tại.

## Chuyển giao

- Yêu cầu chuyển giao mới bắt buộc lý do, công việc đã làm và tình trạng thiết bị.
- Accept kết thúc assignment cũ, tạo assignment mới, giữ first actual repair start và tính lại ETA.
- Reject không kết thúc assignment hiện tại; ghi chú phản hồi không ghi đè lý do ban đầu.

## Ranh giới giữ nguyên

- Không có appointment capacity rule, auto assign, customer account/online approval hay raw status endpoint.
- finalPrice null không phải 0; payment/handover tiếp tục dùng validation Phase 1.
- Không có ServiceType “Kiểm tra & tư vấn”, PaymentMethod QR hoặc tồn kho theo remaining quantity của lot.
- Mỗi ticket mới phải có ít nhất một catalog service với standard duration dương; không còn fallback 30 phút.
- Warranty là context tiếp nhận. Technical method của warranty chỉ là REPAIR hoặc REPLACEMENT theo cấu hình catalog nguồn.
