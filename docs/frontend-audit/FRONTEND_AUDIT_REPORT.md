# Frontend audit and delivery report

Ngày audit: 2026-09-14  
Branch/commit bắt đầu: `dev` / `9169924`  
Đề tài: **XÂY DỰNG HỆ THỐNG QUẢN LÝ VÀ HỖ TRỢ KỸ THUẬT TRONG DỊCH VỤ SỬA CHỮA THIẾT BỊ APPLE**

## A. Những gì đã đọc và tái sử dụng

- Tái sử dụng `docs/api-security/endpoint-inventory.json` và `openapi.json` thay vì audit lại 111 endpoint.
- Tái sử dụng `audit-evidence.json`: 16 controller, 111 DTO, 19 enum, 111 method/URI pairs; source, inventory và OpenAPI snapshot khớp nhau tại baseline.
- Đọc có mục tiêu `PublicController`, `InternalTicketController`, `ReceptionistController`, `TechnicianController`, `TransferController`, `AdminInventoryController`, `TicketAccessPolicy`, `TechnicianRecommendationService` và các DTO liên quan bảy candidate gap.
- Đọc `SecurityConfig`, JWT/current actor và error contract trong audit trước để thiết kế public/internal client, 401/403 và route guard.
- Kiểm tra package manager/frontend: ban đầu không có `frontend/`, `package.json`, Vite config hay lockfile. Máy có Node `25.9.0`, npm `11.12.1`.
- Kiểm tra OpenAPI live tại `localhost:8080`: connection refused; không dùng trạng thái test lịch sử để tuyên bố runtime hiện tại pass.

## B. Phát hiện

- Backend giữ 111 endpoint và đủ nền tảng cho public booking theo catalog, phone lookup, warranty eligibility, feedback, auth và phần lớn CRUD/action nội bộ.
- Public contract chưa phân biệt service type bằng code/name và không expose part brand/variant. Selector replacement chuẩn bị về UX nhưng chưa thể kích hoạt đúng dữ liệu.
- Technician chưa có My Work list, incoming transfer inbox, part/inventory lookup hay usage list. Các action theo ID không tạo được một workspace có thể tự khám phá dữ liệu.
- Receptionist recommendation trả workload, estimated availability, branch và eligibility, đủ cho accept recommendation; manual override ngoài tập đề xuất còn thiếu picker hợp quyền.
- Internal ticket detail có theo ID nhưng không có ticket queue/search. Appointment list/detail thiếu customer name/phone và nhãn branch/time projection.
- Public lookup chỉ nhận phone; yêu cầu lookup theo ticket code cần backend contract riêng.
- Không có asset GLB/GLTF có license trong repo. 3D dependency chưa được thêm.

Phân loại bảy candidate: 5 **CONFIRMED GAP**, 2 **PARTIAL GAP**, 0 **NOT A GAP**. Chi tiết ở `docs/frontend-api-gaps.md`.

## C. Kiến trúc frontend đã chọn

- SPA độc lập tại `frontend/`: React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, native fetch.
- Public và ba workspace role dùng layout/navigation riêng; route guard dựa trên `/auth/me`.
- JWT chỉ giữ trong memory. Public requests luôn bỏ Authorization. 401 của current token clear auth/cache; 403 giữ session.
- API wrappers tập trung theo domain. Query state nằm trong TanStack Query; form/wizard state nằm trong feature; không dùng Redux.
- Design direction: refined technical service, trắng/xám ấm, blue tiết chế; Inter theo yêu cầu dự án. Internal dày thông tin hơn public.
- 3D deferred; component boundary có static visual. Khi có asset hợp lệ mới lazy-load React Three Fiber, demand rendering, DPR cap và fallback.

Route tree, folder tree, responsive, error strategy và delivery phases được mô tả đầy đủ trong `docs/frontend-architecture.md`.

## D. Dependencies

Đã cài các dependency cần dùng ngay: React/DOM, React Router, TanStack Query, React Hook Form, Zod, hookform resolvers; Vite/TypeScript/ESLint và type packages. `package-lock.json` đã được tạo, `npm audit` báo 0 vulnerability tại thời điểm cài.

Chưa cài Three.js/R3F/Drei, UI framework, Redux, Axios, animation framework hay mock server vì chưa có nhu cầu hợp lệ trong phase đã thực hiện.

Node 25 trên máy là EOL theo lịch Node hiện tại; `.nvmrc` chọn Node 24 LTS cho project. Build hiện vẫn chạy thành công trên Node đang cài.

## E. File/folder đã tạo

- `docs/frontend-api-coverage.md`: đủ 111 endpoint.
- `docs/frontend-api-gaps.md`: evidence, severity và minimal backend change không cần schema.
- `docs/frontend-architecture.md`: kiến trúc thực tế.
- `docs/frontend-audit/inspect_contracts.py`, `audit-evidence.json`, `generate_coverage.py` và báo cáo này.
- `frontend/`: scaffold, API/auth/router/layout/design system CSS và pages.
- `.gitignore`: bỏ qua frontend build, dependencies và local env.

Không tạo `.env`, token, account, password, JWT secret hay backend mock.

## F. Endpoint coverage hiện tại

- Tổng inventory: **111/111** row trong coverage.
- Có wrapper + UI thực: **41/111** endpoint.
  - Public: 11/11.
  - Auth: 2/2.
  - Receptionist/internal operations: 18 endpoint cho appointment, intake/walk-in, ticket detail, recommendation/assignment, approval, payment, handover và cancel.
  - Technician: 7 endpoint cho inspection start/result, wait/resume, finish, duration và warranty decision.
  - Admin: statistics overview và 2 system-setting operations.
- HTTP-tested hiện tại: **0/111**, vì backend `localhost:8080` không chạy.
- Backend historical tests (120 pass) chỉ là baseline REST/Security, không được tính là frontend test.

Màn hình đã có:

- Public homepage, device/service discovery, booking wizard bốn bước hỗ trợ nhiều thiết bị, booking success, phone lookup, public ticket expansion, warranty eligibility, feedback, và explicit blocker states.
- Internal login, memory auth, `/auth/me`, role redirect/guards, Admin/Receptionist/Technician layouts và dashboard riêng.
- Receptionist appointment list/filter/detail drawer, intake từ lịch/walk-in, ticket workspace, recommendation/assignment, approval, payment, handover và state-specific commands.
- Technician My Work blocker state và ticket workspace theo state cho ticket ID hợp lệ; part/transfer giữ blocker, không tạo fake picker.
- Admin statistics theo branch/date/device type và system settings editor; các CRUD master-data còn lại mới có route shell.

Các route module nội bộ còn lại mới có shell/phase state và chưa được tính Implemented.

## G. Rủi ro và giới hạn

- Các blocker backend trong gap register ngăn My Work, transfer inbox, technician part flow, receptionist ticket queue, public replacement selector và ticket-code lookup hoàn chỉnh.
- Live API chưa được xác minh trong phiên; query params/body/types dựa trên source + committed OpenAPI khớp baseline.
- Không có browser surface trong môi trường automation, nên chưa visual-test desktop/mobile hoặc kiểm tra console bằng trình duyệt.
- Chưa có automated frontend test suite; hiện mới xác minh compiler, lint và production bundler.
- Public timeline chỉ được dựng từ các mốc backend thật (`receivedAt`, `handedOverAt`), không giả intermediate events.
- Các list backend chưa có server pagination; frontend không gửi page/size không tồn tại.
- Working tree có thay đổi ngoài scope: `docs/api-security/MASTER_API_SECURITY_REPORT.md` đang bị xóa và `PasswordHashGenerator.java` untracked. Frontend work không sửa/xóa hai file này.

## H. Bước tiếp theo

1. Khởi động backend/test database rồi chạy HTTP smoke cho 20 endpoint đã tích hợp bằng dữ liệu test hợp lệ; kiểm tra 400/401/403/409 và auth-expiry.
2. Visual QA public routes ở desktop/mobile và sửa layout/focus/keyboard issues.
3. Tiếp tục receptionist intake → recommendation/assignment → approval → payment/handover với endpoint hiện có.
4. Implement Admin master data và selected-branch operational modules.
5. Thực hiện backend gap phase riêng, ưu tiên My Work, transfer inbox, technician part lookup và internal ticket queue; không cần schema migration theo audit hiện tại.
6. Sau khi gap đóng, hoàn thiện technician ticket workspace và public replacement/ticket-code/warranty booking flows.
7. Thêm Vitest/Testing Library và Playwright khi có backend test fixture ổn định, rồi cập nhật từng row coverage.
