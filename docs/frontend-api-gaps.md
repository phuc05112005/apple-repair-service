# Frontend API gap register

Trạng thái chốt ngày 2026-09-15, dựa trên Controller/DTO hiện tại, inventory 126 endpoint, frontend đã build và live E2E với Spring Boot + MySQL 3307.

## Các gap nghiệp vụ bắt buộc

| # | Gap đã xác nhận | Trạng thái cuối | Contract/UI đã triển khai | Schema |
|---:|---|---|---|:---:|
| 1 | Danh sách “Công việc của tôi” theo JWT | **CLOSED** | `GET /api/v1/internal/technician/work`; trang KTV tải assignment của current actor | NO |
| 2 | Inbox chuyển giao đến | **CLOSED** | `GET /api/v1/internal/transfers/incoming`; accept/reject theo transfer ID | NO |
| 3 | Picker phân công/chuyển KTV | **CLOSED** | Recommendation cho lễ tân; transfer candidates cho active technician | NO |
| 4 | Tra cứu linh kiện/tồn kho và usage history | **CLOSED** | `available-parts`, GET/POST part usages và reverse, đều actor-scoped | NO |
| 5 | Ticket queue/search/detail vận hành | **CLOSED** | Queue theo branch/status/query, rich context detail, My Work theo JWT | NO |
| 6 | Hãng/phiên bản linh kiện public | **CLOSED** | Public catalog trả part ID/code/name/brand/variant và display price | NO |
| 7 | Metadata loại dịch vụ public | **CLOSED** | Public catalog trả service type ID/code/name | NO |

Các gap liên quan cũng đã đóng:

- Lookup public nhận đúng một trong `phone` hoặc `ticketCode`.
- Repair item public có device/model/issue/catalog context để mở warranty booking.
- Receptionist có ticket queue để tìm lại internal ID sau refresh.
- Technician có incoming transfer, transfer target, available inventory và usage list sau refresh.
- Admin account management có list/create/profile/role/status, chặn self-disable và self-demotion ở service layer.

## Các giới hạn còn lại

Đây là các cải tiến không chặn luồng nghiệp vụ hiện tại:

| Giới hạn | Ảnh hưởng | Hướng mở rộng khi cần |
|---|---|---|
| Các list trả array, chưa có server pagination | Chỉ đáng kể khi dữ liệu tăng lớn | Thêm `Pageable` mà không đổi UI contract nghiệp vụ |
| Public lookup chưa có timeline chi tiết mọi trạng thái trung gian | Khách vẫn thấy trạng thái, service, part, payment và warranty | Thêm public-safe timeline projection |
| Feedback không có endpoint đọc trạng thái riêng | POST trùng vẫn được backend kiểm soát; UI không preflight | Thêm feedback status vào lookup nếu UX cần |
| Frontend không gọi riêng 13 endpoint bổ trợ | UI dùng list/detail tổng hợp; không thiếu chức năng bắt buộc | Có thể nối GET-by-id/history, direct/cancel transfer khi sản phẩm yêu cầu |

Không còn **CONFIRMED GAP** ở các luồng bắt buộc của phase. Không có thay đổi database schema.

## Bằng chứng xác minh

- Backend: `mvn test` đạt 126/126; `mvn package` đạt.
- Frontend: typecheck, lint và production build đạt.
- Live HTTP: tạo/cập nhật/vô hiệu hóa/kích hoạt lại account; 401/403/400 đúng vai trò và self-disable.
- Live full workflow: booking → confirm/arrive → intake → assignment → My Work → inspection/repair → part usage → payment → handover → lookup → warranty → feedback.
- Chrome headless: login và redirect đúng `/internal/admin`, `/internal/receptionist`, `/internal/technician`; role guard đưa hai role thấp hơn về workspace của mình khi thử mở trang admin.
