# MASTER REST API + SECURITY REPORT

Đề tài: **XÂY DỰNG HỆ THỐNG QUẢN LÝ VÀ HỖ TRỢ KỸ THUẬT TRONG DỊCH VỤ SỬA CHỮA THIẾT BỊ APPLE**

Ngày hoàn tất kiểm chứng: 2026-09-14, Asia/Saigon. Project: `D:/Class/DOAN/CNPM/apple-repair-service/apple-repair-service`.

**MASTER REST API + SECURITY PHASE COMPLETED**

## A. Resume audit và Git

Tiếp tục theo attachment `493e51dc-3b01-47b3-a3a9-b8028e2bdc28`, kế thừa đặc tả MASTER REST API và các checkpoint trước. Nhánh làm việc: **dev**.

Workspace thực tế tại resume ở commit `5ba795b`, sau `7f032c2`. Commit mới nhất có tiêu đề “upadte JwtTokenService file” nhưng diff thực tế chỉ xóa hai báo cáo Markdown ở root; không có Java delta. Giữ nguyên commit đó, không phục hồi các báo cáo đã xóa. `.agents/` và `skills-lock.json` đã untracked trước continuation, được giữ nguyên.

Git báo khác owner do tài khoản sandbox; dùng `git -c safe.directory=<đúng project>` cho từng lệnh, không sửa global Git configuration. Không checkout, reset, revert, merge, push hoặc commit trong continuation này. Các thay đổi hiện tại để người dùng review trên dev.

**Hoàn tất trước continuation:** slot, BCrypt, Statistics, Security/JWT, JSON errors, public/admin/receptionist API, code technician/transfer facade. Surefire baseline lưu đủ **110 PASS**.

**Đang dở lúc resume:** chưa có bằng chứng API cho object authorization và transfer revoke/gain; chưa có full HTTP committed workflow/concurrency verification.

**Chưa làm lúc resume:** dependency/config Swagger, endpoint inventory runtime, final package/JAR/schema/report.

Bằng chứng: [source baseline](continuation-source-baseline.json), [110-test baseline](continuation-test-baseline.json), [work log](WORK_LOG.md). Các ghi chú “chưa có Git” trong log cũ chỉ mô tả ngày trước khi repository được tạo.

## B. Baseline được bảo toàn

| Thành phần | Service baseline | Sau REST/Security |
|---|---:|---:|
| Entity | 26 | 26 |
| Enum | 19 | 19 |
| Repository interface | 26 | 26 |
| Business tables | 26 | 26 |
| Columns / FK / indexes | 219 / 50 / 87 | 219 / 50 / 87 |
| DTO | 79 | 111 |
| Business REST Controller | 0 | 16 |
| Business endpoints | 0 | 111 |
| Tests | 78 | 120 |

Giữ nguyên hash của toàn bộ Entity, Enum và 78 test Service baseline. Giữ cả 110 test trước continuation; không đổi tên, bỏ assertion, disable hoặc skip. Không đổi datasource `localhost:3307/apple_repair_service`; không H2.

Source continuation chỉ thêm **OpenApiConfig** và **3 test classes**; không sửa Java có sẵn. POM thêm springdoc, thêm báo cáo/evidence/scripts kiểm chứng và cập nhật work log. [Audit hash và inventory](source-test-audit.json).

## C. AppointmentSlot

Giữ service đã PASS: create/update/open/close/get/list/availability; branch ACTIVE khi tạo/mở/chuyển slot; start < end; unique branch/date/start/end; slot có lịch sử booking không được chuyển mốc/branch. Public chỉ trả OPEN slot phù hợp và không ở quá khứ. Không capacity/bookedCount persistence; activeBookingCount tính động, loại CANCELLED/EXPIRED. Sáu unit tests và HTTP booking/slot kiểm chứng lại trong final suite.

## D. Internal user và BCrypt

ADMIN tạo tài khoản nội bộ; BCrypt cost 12 trong production PasswordEncoder. Username duplicate bị 409; password không persist plaintext, DTO credentials có toString redacted và response không chứa password/hash. Giới hạn BCrypt 72 UTF-8 bytes được kiểm tra tại service. Chỉ ADMIN/RECEPTIONIST/TECHNICIAN, không customer account/register/reset-password API.

Tạo và login user qua HTTP đã PASS cả integration lẫn executable JAR. Account INACTIVE không login, token cũ bị chặn ngay ở request tiếp theo.

## E. Statistics / UC15

`GET /api/v1/admin/statistics/overview?from=&to=&branchId=&deviceTypeId=`, ADMIN only.

- totalTickets và currentStatusCounts: receivedAt.
- paidRevenue: paidAt, PAID, chỉ APPROVED RepairItem.finalPrice; BigDecimal; không join/cộng PartUsage.
- warrantyReturnTickets: DISTINCT ticket có RepairItem.warrantySourceItem.
- LocalDate inclusive: `>= from.atStartOfDay()` và `< to.plusDays(1).atStartOfDay()`.
- Device type đi qua ticket.customerDevice.deviceModel.deviceType; không thêm cột.
- Typed StatisticsOverviewResponse/StatusCountResponse; đủ trạng thái kể cả count=0.

Statistics 2 unit + 3 integration thật MySQL PASS, gồm hai biên ngày, next midnight, paidAt khác receivedAt, branch/type filters, rejected/pending items, unpaid tickets và nhiều warranty items cùng ticket.

## F. Security foundation và JWT

SecurityConfig stateless; session/request-cache/form-login/HTTP Basic tắt, CSRF tắt cho REST bearer. JWT filter trước UsernamePasswordAuthenticationFilter, servlet auto-registration của filter bị tắt để không chạy hai lần. JSON AuthenticationEntryPoint/AccessDeniedHandler. Không anyRequest().permitAll(); phần còn lại authenticated.

HS256 qua Nimbus encoder/decoder, secret từ `JWT_SECRET`; fail-fast nếu dưới 32 UTF-8 bytes. Claims gồm subject=username, userId, role, iat, exp, issuer; không password/hash. Kiểm tra signature, issuer, timestamps, claim structure. Mỗi bearer request đọc user hiện tại từ DB, dùng role/status DB thay vì tin role cũ trong token. Không session, refresh-token hoặc persistence mới.

CORS dùng danh sách origin cấu hình, không wildcard, credentials=false. Open-in-view=false; DTO mapping trong transaction. Final HTTP workflow dùng commit thực tế chứng minh response vẫn usable sau transaction.

## G. Auth API và actor identity

`POST /api/v1/auth/login` public; `GET /api/v1/auth/me` authenticated. Login đúng trả Bearer token/expiry/user summary; sai password, unknown username và inactive đều 401 dạng JSON.

Actor lấy từ CurrentActor/SecurityContext: confirm/intake/walk-in/assignment/inspection/history/part use/reverse/stock movement/transfer/handover/customer approval. HTTP command DTO không nhận actor IDs; target technicianId là resource do client chọn. Test runtime quét tất cả request-body DTO của Controller để phát hiện actor field.

Body có actor lạ ở DTO có body bị reject do fail-on-unknown-properties=true. Body gửi vào command không đọc body (confirm) không ảnh hưởng actor; test xác nhận confirmedBy vẫn đúng JWT. User/stock/transfer responses và DB/history assertions chứng minh actor đúng.

Payment baseline không có field người ghi nhận riêng; giữ payment trong ticket, authorize RECEPTIONIST, không thêm audit/payment table. Warranty baseline chỉ có decision/note; không tự thêm actor column.

## H. Public API và DTO riêng

11 endpoints public: catalog/device types/models/issues/branches, slot availability, create/lookup appointment, ticket history lookup, warranty eligibility, feedback. ACTIVE filtering nằm ở repository; DeviceModel và catalog cũng xét các master parent ACTIVE.

Public DTO không lộ inspection/approval notes, staff identifiers hoặc assignment internals. Chỉ giữ appointmentId phục vụ đối chiếu, repairItemId phục vụ eligibility, catalog IDs phục vụ chọn dịch vụ. Booking trả 201, feedback trả 201.

Warranty kiểm tra item thuộc customer phone. Feedback kiểm tra ticketCode + owner phone trước khi gọi FeedbackService; HANDED_OVER và uniqueness vẫn do service cũ kiểm soát. Wrong owner trả 404. Public lookup theo phone là yêu cầu hiện tại, chưa có OTP hay chứng minh người gọi sở hữu số điện thoại; đây là giới hạn của flow hiện tại, không coi phone lookup là xác thực mạnh.

## I. Admin API

Quản trị users; 7 master resources (branches, device types/models, service types/issues, parts, catalog); settings; appointment slots; technician schedules; stock-in/out/branch transfer; Statistics. Không hard delete. Stock actor từ JWT. ADMIN chỉ có quyền operational read ở các endpoint được liệt kê; không tự động có mọi quyền của RECEPTIONIST/TECHNICIAN.

Admin API integration: BCrypt creation, duplicate 409, activate/deactivate, stats typed response, 404, stock actor spoof rejection, insufficient stock 409.

## J. Receptionist API

Filter/read appointment; confirm/reschedule/cancel/arrive/expire; intake appointment device; walk-in; cancel ticket đúng state; recommendation và assignment; record approval; payment/settle-zero/handover. Controller mỏng, gọi service cũ và compose request actor từ JWT. Intake/public create vẫn giữ RetryingWrites/WriteTransaction boundary.

Handover chọn **RECEPTIONIST only**: assignment đã ENDED khi vào WAITING_HANDOVER. Không mở technician handover sẽ mâu thuẫn yêu cầu ACTIVE assignee ở thời điểm này. Customer approval cũng RECEPTIONIST only. Các quyết định role này được giữ từ checkpoint trước và ghi rõ cho frontend phase sau.

## K. Technician API

Start/record inspection, wait-for-part, resume, finish, duration, use/reverse part, warranty decision qua TechnicianOperationsService. Không arbitrary status API. Mỗi mutation xác nhận ACTIVE assignee trong cùng transaction giữ ticket lock; RepairItem/PartUsage được truy ngược tới ticket để check.

B sai assignee nhận 403 trước nghiệp vụ; A đúng assignee thành công nếu state hợp lệ. Internal ticket/assignment/transfer history read cho TECHNICIAN cũng giới hạn ACTIVE assignment; ADMIN/RECEPTIONIST được read theo role. Sau finish/transfer, kỹ thuật viên cũ mất access tới ticket theo policy này.

## L. TicketAccessPolicy và concurrency

`TechnicianOperationsService @Transactional(READ_COMMITTED)` → `TicketAccessPolicy @Transactional(MANDATORY)` → DomainAccess.lock(ServiceTicket) → query ACTIVE assignment → so sánh JWT actor → service mutation → commit.

Không tách check và write sang hai transaction. Giữ pessimistic ticket lock hiện hữu; DomainAccess flush-before-refresh vẫn nguyên trạng. Assignment/transfer cũng serialize trên ticket. Không synchronized, Redis hay lock ngoài DB.

Test `transferWaitsForAuthorizedMutationTransactionThenRevokesOldActor` dùng hai HTTP worker threads, transaction manager/repository/MySQL thật. Mockito spy chỉ chèn latch sau **real** permission check; không thay kết quả hay mock DB. Transfer bắt đầu nhưng không thể hoàn thành trong lúc mutation giữ khóa. Nhả latch: mutation commit rồi transfer commit; A nhận 403, B tiếp tục inspection thành công. Test PASS cả checkpoint, clean test và clean package.

## M. Transfer authorization

| Action/trạng thái | Quyền |
|---|---|
| REQUEST | ACTIVE assignee hiện tại |
| DIRECT | RECEPTIONIST |
| ACCEPT / REJECT | đúng targetTechnician của transfer |
| CANCEL | requester TECHNICIAN hoặc RECEPTIONIST |
| PENDING request | A còn ACTIVE/quyền sửa, B chưa có quyền sửa |
| ACCEPT / DIRECT | A ENDED, B ACTIVE, A mất quyền, B có quyền |
| REJECT / CANCEL | A giữ assignment/quyền; B không được sửa |

Actor requestedBy/respondedBy lấy JWT; target là input resource. Ticket business status không tự đổi do transfer. Policy khóa ticket → assignment → transfer; giữ TransferService validation/target shift/rule hiện hữu. Test toàn bộ các trường hợp và wrong-target 403 đã PASS.

## N. Inventory, approval, warranty và payment

Part usage: item → ticket → ACTIVE assignment check; reverse usage cũng check ticket, trạng thái ACTIVE/once-only do InventoryService. Giữ Part lock, BranchInventory FOR UPDATE, deterministic branch order, stock atomicity và rollback. Test A dùng 2 trên tồn 5 → 3; B bị 403; A reverse → 5; reverse lần hai 409.

Approval: TECHNICIAN bị 403; RECEPTIONIST gọi RepairItemService với actor từ JWT. State machine/approved proposal history không được viết lại.

Warranty: chỉ ACTIVE technician; wrong technician 403, đúng technician quyết định APPROVED thành công, finalPrice=0, không sửa ngày hết hạn nguồn. Eligibility/source/customer/model/type/state rules do WarrantyService/WarrantyPolicy cũ kiểm soát. Warranty days được xử lý theo baseline khi finish/handover; không thêm Warranty table.

Payment: RECEPTIONIST, tổng chỉ APPROVED.finalPrice. Part salePrice 999 × quantity 2 trong full HTTP test không làm bill tăng: tổng vẫn 90 sau discount. Positive chưa PAID không handover; zero có endpoint settle-zero và regression Service cũ chứng minh method=null. Không Payment entity/table.

## O. GlobalExceptionHandler

| Lỗi | HTTP / code |
|---|---|
| Invalid DTO/params | 400 VALIDATION_ERROR |
| JSON sai/unknown field | 400 MALFORMED_JSON |
| Business input | 400 BUSINESS_RULE_VIOLATION |
| Authentication | 401 AUTHENTICATION_FAILED |
| Role/object authorization | 403 ACCESS_DENIED |
| Missing resource | 404 RESOURCE_NOT_FOUND |
| Duplicate | 409 DUPLICATE_RESOURCE |
| Conflict | 409 CONFLICT |
| Invalid transition | 409 INVALID_STATE_TRANSITION |
| Insufficient stock | 409 INSUFFICIENT_STOCK |
| Wrong method/media | 405 / 415 |
| Unexpected | 500 INTERNAL_ERROR, thông báo generic |

ApiErrorResponse typed: timestamp/status/error/code/message/path/fieldErrors. Không rejectedValue, stacktrace, SQL, secret trong response. Unexpected exception log server-side; không trả chi tiết cho client. Scenarios 400/401/403/404/409 có real HTTP assertions.

## P. Controller và endpoint inventory

**16 @RestController + 1 @RestControllerAdvice**, **111 business HTTP method/URI pairs**. Không tính framework /error, Swagger/static resources vào 111. Runtime mapping và generated OpenAPI khớp tất cả endpoint.

| Controller | Endpoints |
|---|---:|
| AdminBranchController | 6 |
| AdminConfigurationController | 12 |
| AdminDeviceModelController | 6 |
| AdminDeviceTypeController | 6 |
| AdminInventoryController | 4 |
| AdminPartController | 6 |
| AdminServiceCatalogController | 6 |
| AdminServiceIssueController | 6 |
| AdminServiceTypeController | 6 |
| AdminUserController | 6 |
| AuthController | 2 |
| InternalTicketController | 3 |
| PublicController | 11 |
| ReceptionistController | 17 |
| TechnicianController | 9 |
| TransferController | 5 |


Role matrix tổng quát: AUTH/public được khai báo theo method/path; ADMIN prefix có cả filter constraint và method security; nội bộ có explicit role annotations; technician object guard nằm ở service transaction. [Inventory JSON](endpoint-inventory.json), [OpenAPI JSON](openapi.json). Cột service dưới đây là lời gọi trực tiếp ở Controller; facade/actor flow giải thích ở G–N.

| HTTP | URI | Access/roles | Controller.method | Service/helper gọi trực tiếp | Request body | Response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/appointment-slots` | hasRole('ADMIN') | AdminConfigurationController.slots | AppointmentSlotService.list | none | List<SlotAvailabilityResponse> |
| POST | `/api/v1/admin/appointment-slots` | hasRole('ADMIN') | AdminConfigurationController.createSlot | AppointmentSlotService.create | SaveAppointmentSlotRequest | SlotAvailabilityResponse |
| GET | `/api/v1/admin/appointment-slots/{id}` | hasRole('ADMIN') | AdminConfigurationController.slot | AppointmentSlotService.getById | none | SlotAvailabilityResponse |
| PUT | `/api/v1/admin/appointment-slots/{id}` | hasRole('ADMIN') | AdminConfigurationController.updateSlot | AppointmentSlotService.update | SaveAppointmentSlotRequest | SlotAvailabilityResponse |
| POST | `/api/v1/admin/appointment-slots/{id}/close` | hasRole('ADMIN') | AdminConfigurationController.close | AppointmentSlotService.close | none | SlotAvailabilityResponse |
| POST | `/api/v1/admin/appointment-slots/{id}/open` | hasRole('ADMIN') | AdminConfigurationController.open | AppointmentSlotService.open | none | SlotAvailabilityResponse |
| GET | `/api/v1/admin/branches` | hasRole('ADMIN') | AdminBranchController.list | BranchService.list | none | List<BranchResponse> |
| POST | `/api/v1/admin/branches` | hasRole('ADMIN') | AdminBranchController.create | BranchService.create | CreateBranchRequest | BranchResponse |
| GET | `/api/v1/admin/branches/{id}` | hasRole('ADMIN') | AdminBranchController.get | BranchService.getById | none | BranchResponse |
| PUT | `/api/v1/admin/branches/{id}` | hasRole('ADMIN') | AdminBranchController.update | BranchService.update | UpdateBranchRequest | BranchResponse |
| POST | `/api/v1/admin/branches/{id}/activate` | hasRole('ADMIN') | AdminBranchController.activate | BranchService.activate | none | BranchResponse |
| POST | `/api/v1/admin/branches/{id}/deactivate` | hasRole('ADMIN') | AdminBranchController.deactivate | BranchService.deactivate | none | BranchResponse |
| GET | `/api/v1/admin/device-models` | hasRole('ADMIN') | AdminDeviceModelController.list | DeviceModelService.list | none | List<DeviceModelResponse> |
| POST | `/api/v1/admin/device-models` | hasRole('ADMIN') | AdminDeviceModelController.create | DeviceModelService.create | CreateDeviceModelRequest | DeviceModelResponse |
| GET | `/api/v1/admin/device-models/{id}` | hasRole('ADMIN') | AdminDeviceModelController.get | DeviceModelService.getById | none | DeviceModelResponse |
| PUT | `/api/v1/admin/device-models/{id}` | hasRole('ADMIN') | AdminDeviceModelController.update | DeviceModelService.update | UpdateDeviceModelRequest | DeviceModelResponse |
| POST | `/api/v1/admin/device-models/{id}/activate` | hasRole('ADMIN') | AdminDeviceModelController.activate | DeviceModelService.activate | none | DeviceModelResponse |
| POST | `/api/v1/admin/device-models/{id}/deactivate` | hasRole('ADMIN') | AdminDeviceModelController.deactivate | DeviceModelService.deactivate | none | DeviceModelResponse |
| GET | `/api/v1/admin/device-types` | hasRole('ADMIN') | AdminDeviceTypeController.list | DeviceTypeService.list | none | List<DeviceTypeResponse> |
| POST | `/api/v1/admin/device-types` | hasRole('ADMIN') | AdminDeviceTypeController.create | DeviceTypeService.create | CreateDeviceTypeRequest | DeviceTypeResponse |
| GET | `/api/v1/admin/device-types/{id}` | hasRole('ADMIN') | AdminDeviceTypeController.get | DeviceTypeService.getById | none | DeviceTypeResponse |
| PUT | `/api/v1/admin/device-types/{id}` | hasRole('ADMIN') | AdminDeviceTypeController.update | DeviceTypeService.update | UpdateDeviceTypeRequest | DeviceTypeResponse |
| POST | `/api/v1/admin/device-types/{id}/activate` | hasRole('ADMIN') | AdminDeviceTypeController.activate | DeviceTypeService.activate | none | DeviceTypeResponse |
| POST | `/api/v1/admin/device-types/{id}/deactivate` | hasRole('ADMIN') | AdminDeviceTypeController.deactivate | DeviceTypeService.deactivate | none | DeviceTypeResponse |
| POST | `/api/v1/admin/inventory/stock-in` | hasRole('ADMIN') | AdminInventoryController.stockIn | InventoryService.stockIn, CurrentActor.id | StockAdjustmentCommand | BranchInventoryResponse |
| POST | `/api/v1/admin/inventory/stock-out` | hasRole('ADMIN') | AdminInventoryController.stockOut | InventoryService.stockOut, CurrentActor.id | StockAdjustmentCommand | BranchInventoryResponse |
| POST | `/api/v1/admin/inventory/transfer` | hasRole('ADMIN') | AdminInventoryController.transfer | InventoryService.transferStock, CurrentActor.id | StockTransferCommand | InventoryTransactionResponse |
| GET | `/api/v1/admin/parts` | hasRole('ADMIN') | AdminPartController.list | PartService.list | none | List<PartResponse> |
| POST | `/api/v1/admin/parts` | hasRole('ADMIN') | AdminPartController.create | PartService.create | CreatePartRequest | PartResponse |
| GET | `/api/v1/admin/parts/{id}` | hasRole('ADMIN') | AdminPartController.get | PartService.getById | none | PartResponse |
| PUT | `/api/v1/admin/parts/{id}` | hasRole('ADMIN') | AdminPartController.update | PartService.update | UpdatePartRequest | PartResponse |
| POST | `/api/v1/admin/parts/{id}/activate` | hasRole('ADMIN') | AdminPartController.activate | PartService.activate | none | PartResponse |
| POST | `/api/v1/admin/parts/{id}/deactivate` | hasRole('ADMIN') | AdminPartController.deactivate | PartService.deactivate | none | PartResponse |
| GET | `/api/v1/admin/service-catalog-items` | hasRole('ADMIN') | AdminServiceCatalogController.list | ServiceCatalogService.list | none | List<ServiceCatalogItemResponse> |
| POST | `/api/v1/admin/service-catalog-items` | hasRole('ADMIN') | AdminServiceCatalogController.create | ServiceCatalogService.create | CreateServiceCatalogItemRequest | ServiceCatalogItemResponse |
| GET | `/api/v1/admin/service-catalog-items/{id}` | hasRole('ADMIN') | AdminServiceCatalogController.get | ServiceCatalogService.getById | none | ServiceCatalogItemResponse |
| PUT | `/api/v1/admin/service-catalog-items/{id}` | hasRole('ADMIN') | AdminServiceCatalogController.update | ServiceCatalogService.update | UpdateServiceCatalogItemRequest | ServiceCatalogItemResponse |
| POST | `/api/v1/admin/service-catalog-items/{id}/activate` | hasRole('ADMIN') | AdminServiceCatalogController.activate | ServiceCatalogService.activate | none | ServiceCatalogItemResponse |
| POST | `/api/v1/admin/service-catalog-items/{id}/deactivate` | hasRole('ADMIN') | AdminServiceCatalogController.deactivate | ServiceCatalogService.deactivate | none | ServiceCatalogItemResponse |
| GET | `/api/v1/admin/service-issues` | hasRole('ADMIN') | AdminServiceIssueController.list | ServiceIssueService.list | none | List<ServiceIssueResponse> |
| POST | `/api/v1/admin/service-issues` | hasRole('ADMIN') | AdminServiceIssueController.create | ServiceIssueService.create | CreateServiceIssueRequest | ServiceIssueResponse |
| GET | `/api/v1/admin/service-issues/{id}` | hasRole('ADMIN') | AdminServiceIssueController.get | ServiceIssueService.getById | none | ServiceIssueResponse |
| PUT | `/api/v1/admin/service-issues/{id}` | hasRole('ADMIN') | AdminServiceIssueController.update | ServiceIssueService.update | UpdateServiceIssueRequest | ServiceIssueResponse |
| POST | `/api/v1/admin/service-issues/{id}/activate` | hasRole('ADMIN') | AdminServiceIssueController.activate | ServiceIssueService.activate | none | ServiceIssueResponse |
| POST | `/api/v1/admin/service-issues/{id}/deactivate` | hasRole('ADMIN') | AdminServiceIssueController.deactivate | ServiceIssueService.deactivate | none | ServiceIssueResponse |
| GET | `/api/v1/admin/service-types` | hasRole('ADMIN') | AdminServiceTypeController.list | ServiceTypeService.list | none | List<ServiceTypeResponse> |
| POST | `/api/v1/admin/service-types` | hasRole('ADMIN') | AdminServiceTypeController.create | ServiceTypeService.create | CreateServiceTypeRequest | ServiceTypeResponse |
| GET | `/api/v1/admin/service-types/{id}` | hasRole('ADMIN') | AdminServiceTypeController.get | ServiceTypeService.getById | none | ServiceTypeResponse |
| PUT | `/api/v1/admin/service-types/{id}` | hasRole('ADMIN') | AdminServiceTypeController.update | ServiceTypeService.update | UpdateServiceTypeRequest | ServiceTypeResponse |
| POST | `/api/v1/admin/service-types/{id}/activate` | hasRole('ADMIN') | AdminServiceTypeController.activate | ServiceTypeService.activate | none | ServiceTypeResponse |
| POST | `/api/v1/admin/service-types/{id}/deactivate` | hasRole('ADMIN') | AdminServiceTypeController.deactivate | ServiceTypeService.deactivate | none | ServiceTypeResponse |
| GET | `/api/v1/admin/statistics/overview` | hasRole('ADMIN') | AdminConfigurationController.statistics | StatisticsService.overview | none | StatisticsOverviewResponse |
| GET | `/api/v1/admin/system-settings` | hasRole('ADMIN') | AdminConfigurationController.settings | SystemSettingService.list | none | List<SystemSettingResponse> |
| PUT | `/api/v1/admin/system-settings/{key}` | hasRole('ADMIN') | AdminConfigurationController.setting | SystemSettingService.update | UpdateSystemSettingRequest | SystemSettingResponse |
| GET | `/api/v1/admin/technician-schedules` | hasRole('ADMIN') | AdminConfigurationController.schedules | TechnicianScheduleService.listByTechnicianAndDate | none | List<TechnicianScheduleResponse> |
| POST | `/api/v1/admin/technician-schedules` | hasRole('ADMIN') | AdminConfigurationController.createSchedule | TechnicianScheduleService.create | CreateTechnicianScheduleRequest | TechnicianScheduleResponse |
| PUT | `/api/v1/admin/technician-schedules/{id}` | hasRole('ADMIN') | AdminConfigurationController.updateSchedule | TechnicianScheduleService.update | UpdateTechnicianScheduleRequest | TechnicianScheduleResponse |
| GET | `/api/v1/admin/users` | hasRole('ADMIN') | AdminUserController.list | UserService.list | none | List<UserResponse> |
| POST | `/api/v1/admin/users` | hasRole('ADMIN') | AdminUserController.create | UserService.create | CreateUserRequest | UserResponse |
| GET | `/api/v1/admin/users/{id}` | hasRole('ADMIN') | AdminUserController.get | UserService.getById | none | UserResponse |
| PUT | `/api/v1/admin/users/{id}/profile` | hasRole('ADMIN') | AdminUserController.profile | UserService.updateProfile | UpdateUserProfileRequest | UserResponse |
| PUT | `/api/v1/admin/users/{id}/role` | hasRole('ADMIN') | AdminUserController.role | UserService.updateRole | UpdateUserRoleRequest | UserResponse |
| PUT | `/api/v1/admin/users/{id}/status` | hasRole('ADMIN') | AdminUserController.status | UserService.updateStatus | UpdateUserStatusRequest | UserResponse |
| GET | `/api/v1/appointment-slots` | public | PublicController.slots | AppointmentSlotService.availability | none | List<SlotAvailabilityResponse> |
| POST | `/api/v1/appointments` | public | PublicController.createAppointment | PublicCommandService.createAppointment | CreateAppointmentRequest | PublicAppointmentResponse |
| GET | `/api/v1/appointments/lookup` | public | PublicController.appointments | PublicQueryService.appointments | none | List<PublicAppointmentResponse> |
| POST | `/api/v1/auth/login` | public | AuthController.login | AuthService.login | LoginRequest | LoginResponse |
| GET | `/api/v1/auth/me` | authenticated | AuthController.me | CurrentActor.principal | none | CurrentUserResponse |
| GET | `/api/v1/branches` | public | PublicController.branches | PublicQueryService.branches | none | List<PublicBranchResponse> |
| GET | `/api/v1/device-models` | public | PublicController.deviceModels | PublicQueryService.deviceModels | none | List<PublicDeviceModelResponse> |
| GET | `/api/v1/device-types` | public | PublicController.deviceTypes | PublicQueryService.deviceTypes | none | List<PublicNamedResponse> |
| POST | `/api/v1/internal/appointment-devices/{appointmentDeviceId}/intake` | hasRole('RECEPTIONIST') | ReceptionistController.intake | ServiceTicketService.intakeAppointmentDevice, CurrentActor.id | IntakeDeviceCommand | ServiceTicketDetailResponse |
| GET | `/api/v1/internal/appointments` | hasAnyRole('ADMIN','RECEPTIONIST') | ReceptionistController.appointments | AppointmentService.list | none | List<AppointmentDetailResponse> |
| GET | `/api/v1/internal/appointments/{id}` | hasAnyRole('ADMIN','RECEPTIONIST') | ReceptionistController.appointment | AppointmentService.getById | none | AppointmentDetailResponse |
| POST | `/api/v1/internal/appointments/{id}/arrive` | hasRole('RECEPTIONIST') | ReceptionistController.arrive | AppointmentService.markArrived | none | AppointmentDetailResponse |
| POST | `/api/v1/internal/appointments/{id}/cancel` | hasRole('RECEPTIONIST') | ReceptionistController.cancelAppointment | AppointmentService.cancelAppointment | ReasonCommand | AppointmentDetailResponse |
| POST | `/api/v1/internal/appointments/{id}/confirm` | hasRole('RECEPTIONIST') | ReceptionistController.confirm | AppointmentService.confirmAppointment, CurrentActor.id | none | AppointmentDetailResponse |
| POST | `/api/v1/internal/appointments/{id}/expire` | hasRole('RECEPTIONIST') | ReceptionistController.expire | AppointmentService.expireAppointment | none | AppointmentDetailResponse |
| POST | `/api/v1/internal/appointments/{id}/reschedule` | hasRole('RECEPTIONIST') | ReceptionistController.reschedule | AppointmentService.rescheduleAppointment | RescheduleAppointmentRequest | AppointmentDetailResponse |
| GET | `/api/v1/internal/inventory` | hasRole('ADMIN') | AdminInventoryController.inventory | InventoryService.getInventory | none | BranchInventoryResponse |
| POST | `/api/v1/internal/part-usages/{id}/reverse` | hasRole('TECHNICIAN') | TechnicianController.reverse | TechnicianOperationsService.reverseUsage | NoteCommand | PartUsageResponse |
| POST | `/api/v1/internal/repair-items/{id}/approval` | hasRole('RECEPTIONIST') | ReceptionistController.approval | RepairItemService.recordApprovalDecision, CurrentActor.id | ApprovalCommand | RepairItemResponse |
| POST | `/api/v1/internal/repair-items/{id}/part-usages` | hasRole('TECHNICIAN') | TechnicianController.usePart | TechnicianOperationsService.usePart | PartUsageCommand | PartUsageResponse |
| POST | `/api/v1/internal/repair-items/{id}/warranty-decision` | hasRole('TECHNICIAN') | TechnicianController.warranty | TechnicianOperationsService.warranty | WarrantyDecisionRequest | RepairItemResponse |
| POST | `/api/v1/internal/service-tickets/walk-in` | hasRole('RECEPTIONIST') | ReceptionistController.walkIn | ServiceTicketService.createWalkInTicket, CurrentActor.id | WalkInIntakeRequest | ServiceTicketDetailResponse |
| GET | `/api/v1/internal/service-tickets/{id}` | hasAnyRole('ADMIN','RECEPTIONIST','TECHNICIAN') | InternalTicketController.ticket | InternalTicketQueryService.ticket | none | ServiceTicketDetailResponse |
| GET | `/api/v1/internal/service-tickets/{id}/assignments` | hasAnyRole('ADMIN','RECEPTIONIST','TECHNICIAN') | InternalTicketController.assignments | InternalTicketQueryService.assignments | none | List<AssignmentResponse> |
| POST | `/api/v1/internal/service-tickets/{id}/assignments` | hasRole('RECEPTIONIST') | ReceptionistController.assign | AssignmentService.assignTechnician, CurrentActor.id | AssignTechnicianCommand | AssignmentResponse |
| POST | `/api/v1/internal/service-tickets/{id}/cancel` | hasRole('RECEPTIONIST') | ReceptionistController.cancelTicket | ServiceTicketService.cancelTicket, CurrentActor.id | ReasonCommand | ServiceTicketDetailResponse |
| POST | `/api/v1/internal/service-tickets/{id}/finish-repair` | hasRole('TECHNICIAN') | TechnicianController.finish | TechnicianOperationsService.finishRepair | none | ServiceTicketDetailResponse |
| POST | `/api/v1/internal/service-tickets/{id}/handover` | hasRole('RECEPTIONIST') | ReceptionistController.handover | ServiceTicketService.handover, CurrentActor.id | none | ServiceTicketDetailResponse |
| POST | `/api/v1/internal/service-tickets/{id}/inspection` | hasRole('TECHNICIAN') | TechnicianController.inspection | TechnicianOperationsService.inspect | InspectionCommand | ServiceTicketDetailResponse |
| POST | `/api/v1/internal/service-tickets/{id}/inspection/start` | hasRole('TECHNICIAN') | TechnicianController.start | TechnicianOperationsService.startInspection | none | ServiceTicketDetailResponse |
| POST | `/api/v1/internal/service-tickets/{id}/payment` | hasRole('RECEPTIONIST') | ReceptionistController.payment | PaymentService.recordPayment | RecordPaymentRequest | TicketPaymentSummaryResponse |
| GET | `/api/v1/internal/service-tickets/{id}/payment-summary` | hasRole('RECEPTIONIST') | ReceptionistController.paymentSummary | PaymentService.getSummary | none | TicketPaymentSummaryResponse |
| POST | `/api/v1/internal/service-tickets/{id}/payment/settle-zero` | hasRole('RECEPTIONIST') | ReceptionistController.settleZero | PaymentService.settleZeroAmountTicket | none | TicketPaymentSummaryResponse |
| GET | `/api/v1/internal/service-tickets/{id}/repair-duration` | hasRole('TECHNICIAN') | TechnicianController.duration | TechnicianOperationsService.duration | none | RepairDurationResponse |
| POST | `/api/v1/internal/service-tickets/{id}/resume-repair` | hasRole('TECHNICIAN') | TechnicianController.resume | TechnicianOperationsService.resumeRepair | none | ServiceTicketDetailResponse |
| GET | `/api/v1/internal/service-tickets/{id}/technician-recommendations` | hasRole('RECEPTIONIST') | ReceptionistController.recommend | TechnicianRecommendationService.recommend | none | List<TechnicianRecommendationResponse> |
| GET | `/api/v1/internal/service-tickets/{id}/transfers` | hasAnyRole('ADMIN','RECEPTIONIST','TECHNICIAN') | InternalTicketController.transfers | InternalTicketQueryService.transfers | none | List<TransferResponse> |
| POST | `/api/v1/internal/service-tickets/{id}/wait-for-part` | hasRole('TECHNICIAN') | TechnicianController.waitForPart | TechnicianOperationsService.waitForPart | NoteCommand | ServiceTicketDetailResponse |
| POST | `/api/v1/internal/service-tickets/{ticketId}/transfers/direct` | hasRole('RECEPTIONIST') | TransferController.direct | TransferOperationsService.direct | TransferCommand | TransferResponse |
| POST | `/api/v1/internal/service-tickets/{ticketId}/transfers/request` | hasRole('TECHNICIAN') | TransferController.request | TransferOperationsService.request | TransferCommand | TransferResponse |
| POST | `/api/v1/internal/transfers/{id}/accept` | hasRole('TECHNICIAN') | TransferController.accept | TransferOperationsService.accept | NoteCommand | TransferResponse |
| POST | `/api/v1/internal/transfers/{id}/cancel` | hasAnyRole('TECHNICIAN','RECEPTIONIST') | TransferController.cancel | TransferOperationsService.cancel | NoteCommand | TransferResponse |
| POST | `/api/v1/internal/transfers/{id}/reject` | hasRole('TECHNICIAN') | TransferController.reject | TransferOperationsService.reject | NoteCommand | TransferResponse |
| GET | `/api/v1/service-catalog-items` | public | PublicController.catalog | PublicQueryService.catalog | none | List<PublicCatalogResponse> |
| GET | `/api/v1/service-issues` | public | PublicController.serviceIssues | PublicQueryService.serviceIssues | none | List<PublicNamedResponse> |
| GET | `/api/v1/service-tickets/lookup` | public | PublicController.tickets | PublicQueryService.tickets | none | List<PublicTicketResponse> |
| POST | `/api/v1/service-tickets/{ticketCode}/feedback` | public | PublicController.feedback | PublicCommandService.feedback | PublicFeedbackRequest | PublicFeedbackResponse |
| GET | `/api/v1/warranties/eligibility` | public | PublicController.eligibility | PublicQueryService.eligibility | none | WarrantyEligibilityResponse |


## Q. DTO / Service / Repository inventory

Toàn phase so với Service baseline: **32 DTO mới**, tổng 111. Continuation này thêm **0 DTO**, không sửa DTO cũ.

- [CurrentUserResponse](../../src/main/java/com/applecare/apple_repair_service/dto/auth/CurrentUserResponse.java)
- [LoginRequest](../../src/main/java/com/applecare/apple_repair_service/dto/auth/LoginRequest.java)
- [LoginResponse](../../src/main/java/com/applecare/apple_repair_service/dto/auth/LoginResponse.java)
- [ApprovalCommand](../../src/main/java/com/applecare/apple_repair_service/dto/command/ApprovalCommand.java)
- [AssignTechnicianCommand](../../src/main/java/com/applecare/apple_repair_service/dto/command/AssignTechnicianCommand.java)
- [InspectionCommand](../../src/main/java/com/applecare/apple_repair_service/dto/command/InspectionCommand.java)
- [IntakeDeviceCommand](../../src/main/java/com/applecare/apple_repair_service/dto/command/IntakeDeviceCommand.java)
- [NoteCommand](../../src/main/java/com/applecare/apple_repair_service/dto/command/NoteCommand.java)
- [PartUsageCommand](../../src/main/java/com/applecare/apple_repair_service/dto/command/PartUsageCommand.java)
- [ReasonCommand](../../src/main/java/com/applecare/apple_repair_service/dto/command/ReasonCommand.java)
- [StockAdjustmentCommand](../../src/main/java/com/applecare/apple_repair_service/dto/command/StockAdjustmentCommand.java)
- [StockTransferCommand](../../src/main/java/com/applecare/apple_repair_service/dto/command/StockTransferCommand.java)
- [TransferCommand](../../src/main/java/com/applecare/apple_repair_service/dto/command/TransferCommand.java)
- [ApiErrorResponse](../../src/main/java/com/applecare/apple_repair_service/dto/error/ApiErrorResponse.java)
- [FieldErrorResponse](../../src/main/java/com/applecare/apple_repair_service/dto/error/FieldErrorResponse.java)
- [PublicAppointmentDeviceResponse](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicAppointmentDeviceResponse.java)
- [PublicAppointmentResponse](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicAppointmentResponse.java)
- [PublicBookedServiceResponse](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicBookedServiceResponse.java)
- [PublicBranchResponse](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicBranchResponse.java)
- [PublicCatalogResponse](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicCatalogResponse.java)
- [PublicDeviceModelResponse](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicDeviceModelResponse.java)
- [PublicFeedbackRequest](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicFeedbackRequest.java)
- [PublicFeedbackResponse](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicFeedbackResponse.java)
- [PublicNamedResponse](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicNamedResponse.java)
- [PublicRepairItemResponse](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicRepairItemResponse.java)
- [PublicTicketResponse](../../src/main/java/com/applecare/apple_repair_service/dto/publicapi/PublicTicketResponse.java)
- [CreateUserRequest](../../src/main/java/com/applecare/apple_repair_service/dto/request/CreateUserRequest.java)
- [SaveAppointmentSlotRequest](../../src/main/java/com/applecare/apple_repair_service/dto/request/SaveAppointmentSlotRequest.java)
- [RepairDurationResponse](../../src/main/java/com/applecare/apple_repair_service/dto/response/RepairDurationResponse.java)
- [SlotAvailabilityResponse](../../src/main/java/com/applecare/apple_repair_service/dto/response/SlotAvailabilityResponse.java)
- [StatisticsOverviewResponse](../../src/main/java/com/applecare/apple_repair_service/dto/response/StatisticsOverviewResponse.java)
- [StatusCountResponse](../../src/main/java/com/applecare/apple_repair_service/dto/response/StatusCountResponse.java)

**10 @Service mới** trong toàn phase (8 nghiệp vụ ở package service và 2 security services); **1 helper policy mới TicketAccessPolicy**. Tổng @Service sau phase: 36. Hai service cũ sửa tối thiểu: UserService.create (BCrypt), AppointmentService.list (filter API).

- [DatabaseUserDetailsService](../../src/main/java/com/applecare/apple_repair_service/security/DatabaseUserDetailsService.java)
- [JwtTokenService](../../src/main/java/com/applecare/apple_repair_service/security/JwtTokenService.java)
- [AppointmentSlotService](../../src/main/java/com/applecare/apple_repair_service/service/AppointmentSlotService.java)
- [AuthService](../../src/main/java/com/applecare/apple_repair_service/service/AuthService.java)
- [InternalTicketQueryService](../../src/main/java/com/applecare/apple_repair_service/service/InternalTicketQueryService.java)
- [PublicCommandService](../../src/main/java/com/applecare/apple_repair_service/service/PublicCommandService.java)
- [PublicQueryService](../../src/main/java/com/applecare/apple_repair_service/service/PublicQueryService.java)
- [StatisticsService](../../src/main/java/com/applecare/apple_repair_service/service/StatisticsService.java)
- [TechnicianOperationsService](../../src/main/java/com/applecare/apple_repair_service/service/TechnicianOperationsService.java)
- [TransferOperationsService](../../src/main/java/com/applecare/apple_repair_service/service/TransferOperationsService.java)

Helper: [TicketAccessPolicy](../../src/main/java/com/applecare/apple_repair_service/service/TicketAccessPolicy.java).

Service cũ sửa:

- [AppointmentService](../../src/main/java/com/applecare/apple_repair_service/service/AppointmentService.java)
- [UserService](../../src/main/java/com/applecare/apple_repair_service/service/UserService.java)

Repository: **0 interface mới**, **8 interface bổ sung query**, tổng vẫn 26:

- [AppointmentRepository](../../src/main/java/com/applecare/apple_repair_service/repository/AppointmentRepository.java)
- [AppointmentSlotRepository](../../src/main/java/com/applecare/apple_repair_service/repository/AppointmentSlotRepository.java)
- [BranchRepository](../../src/main/java/com/applecare/apple_repair_service/repository/BranchRepository.java)
- [DeviceModelRepository](../../src/main/java/com/applecare/apple_repair_service/repository/DeviceModelRepository.java)
- [DeviceTypeRepository](../../src/main/java/com/applecare/apple_repair_service/repository/DeviceTypeRepository.java)
- [ServiceCatalogItemRepository](../../src/main/java/com/applecare/apple_repair_service/repository/ServiceCatalogItemRepository.java)
- [ServiceIssueRepository](../../src/main/java/com/applecare/apple_repair_service/repository/ServiceIssueRepository.java)
- [ServiceTicketRepository](../../src/main/java/com/applecare/apple_repair_service/repository/ServiceTicketRepository.java)

Continuation này thêm/sửa Service=0/0, Repository=0/0; dùng nguyên code đã compile trước đó, bổ sung bằng chứng test. Không có Controller import Entity/Repository, không production field injection, không DTO chứa Entity, không Map<String,Object> response.

## R. Tests và regression

| Mốc | Tests |
|---|---:|
| Service baseline | 78 |
| REST/Security đã thêm trước continuation | 32 |
| Trước continuation | 110 |
| Mới thêm continuation này | 10 |
| Tổng final | **120** |
| Failures / Errors / Skipped | **0 / 0 / 0** |

10 mới = TechnicianAuthorizationIntegrationTest 7 + HttpWorkflowIntegrationTest 2 + OpenApiIntegrationTest 1. Mọi test trước đó giữ nguyên. Integration dùng MySQL thật; Statistics dùng DataJpaTest Replace.NONE, các API dùng SpringBootTest + real SecurityFilterChain. Không H2 hoặc repository mocks để né DB.

| Test class | Tests | Failures | Errors | Skipped |
|---|---:|---:|---:|---:|
| AppleRepairServiceApplicationTests | 1 | 0 | 0 | 0 |
| AdminApiIntegrationTest | 3 | 0 | 0 | 0 |
| ApplicationTransactionsIntegrationTest | 15 | 0 | 0 | 0 |
| AppointmentServiceTest | 13 | 0 | 0 | 0 |
| AppointmentSlotServiceTest | 6 | 0 | 0 | 0 |
| ClosureServiceTest | 10 | 0 | 0 | 0 |
| CustomerIdentityTest | 4 | 0 | 0 | 0 |
| HttpWorkflowIntegrationTest | 2 | 0 | 0 | 0 |
| InventoryServiceTest | 6 | 0 | 0 | 0 |
| JwtTokenServiceTest | 3 | 0 | 0 | 0 |
| MasterDataServiceTest | 4 | 0 | 0 | 0 |
| MlPredictionServiceTest | 4 | 0 | 0 | 0 |
| OpenApiIntegrationTest | 1 | 0 | 0 | 0 |
| PublicApiIntegrationTest | 4 | 0 | 0 | 0 |
| ReceptionistApiIntegrationTest | 2 | 0 | 0 | 0 |
| SecurityIntegrationTest | 6 | 0 | 0 | 0 |
| StatisticsIntegrationTest | 3 | 0 | 0 | 0 |
| StatisticsServiceTest | 2 | 0 | 0 | 0 |
| TechnicianAuthorizationIntegrationTest | 7 | 0 | 0 | 0 |
| TechnicianServiceTest | 10 | 0 | 0 | 0 |
| TicketCoreServiceTest | 11 | 0 | 0 | 0 |
| UserCreationTest | 3 | 0 | 0 | 0 |


[Clean test summary](final-clean-test-summary.json), [package test summary](final-package-test-summary.json). Toàn bộ scenario REST/Security mới so với 78 Service baseline:


**AdminApiIntegrationTest (3)**

- `masterCommandsAndStatisticsRequireAdminAndReturnTypedData`
- `stockCommandsUseAuthenticatedActorRejectSpoofingAndReportInsufficientStock`
- `adminCreatesHashedUsersAndDuplicateUsernameIs409`

**AppointmentSlotServiceTest (6)**

- `createsOpenSlotAndCountsOnlyActiveBookings`
- `inactiveBranchCannotCreateOrPublishAvailability`
- `publicQueryOnlyOpenFutureSlotsAndCloseIsReversible`
- `movingSlotWithHistoryIsRejected`
- `rejectsDuplicateBeforePersistence`
- `rejectsEqualOrReversedTimes`

**HttpWorkflowIntegrationTest (2)**

- `fullHttpBookingRepairPaymentHandoverFeedbackCommitsExpectedState`
- `transferWaitsForAuthorizedMutationTransactionThenRevokesOldActor`

**JwtTokenServiceTest (3)**

- `rejectsMalformedTamperedAndDifferentSigningKey`
- `signedTokenContainsOnlyIdentityClaimsAndExpires`
- `refusesMissingOrShortSecret`

**OpenApiIntegrationTest (1)**

- `swaggerDescribesBearerAndEveryBusinessEndpointHasExplicitAccess`

**PublicApiIntegrationTest (4)**

- `catalogIsAnonymousFilteredAndOmitsInternalData`
- `anonymousBookingAndLookupUsePublicDtoAndClosedSlotsDisappear`
- `invalidFiltersAndMissingRecordsUseTypedErrors`
- `historyWarrantyAndFeedbackEnforcePhoneOwnershipAndHideNotes`

**ReceptionistApiIntegrationTest (2)**

- `receptionistIntakeWritesJwtActorAndRejectsInvalidTransition`
- `technicianCannotTakeReceptionistPaymentOrAppointmentCommands`

**SecurityIntegrationTest (6)**

- `invalidPasswordUnknownUsernameAndInactiveAccountReturnSame401`
- `roleAndAccountChangesImmediatelyAffectExistingToken`
- `loginAndMeUseDatabaseIdentityWithoutPasswordFieldsOrSession`
- `missingMalformedAndExpiredTokensAre401`
- `authenticationJsonValidationIsConsistentAndDoesNotEchoSecrets`
- `receptionistCannotManageUsers`

**StatisticsIntegrationTest (3)**

- `includesBothCalendarBoundariesAndExcludesNextMidnight`
- `filtersBranchAndDeviceTypeConsistently`
- `aggregatesReceiptStatusesAndPaidRevenueWithDistinctWarrantyTickets`

**StatisticsServiceTest (2)**

- `rejectsReversedRangeBeforeQueries`
- `fillsMissingStatusesAndUsesInclusiveCalendarWindow`

**TechnicianAuthorizationIntegrationTest (7)**

- `directTransferRevokesOldTechnicianWithoutChangingBusinessStatus`
- `rejectedRequestPreservesSourceAccessAndOnlyTargetCanReject`
- `onlyActiveAssigneeCanInspectAndReadTicket`
- `warrantyRequiresAssigneeAndApprovalRemainsReceptionistOnly`
- `partUsageAndReversalRequireAssigneeAndReverseOnlyOnce`
- `pendingRequestPreservesSourceAccessAndOnlyTargetCanAccept`
- `cancellationRequiresRequesterOrReceptionist`

**UserCreationTest (3)**

- `duplicateUsernameDoesNotWrite`
- `createsActiveUserWithVerifiedBcryptHashAndSafeResponse`
- `bcryptByteLimitIsValidatedBeforeHashing`


## S. Full HTTP workflow

`fullHttpBookingRepairPaymentHandoverFeedbackCommitsExpectedState`: browse catalog/slot → booking public 201 → receptionist login/list/confirm/arrive/intake 201 → recommendation → assignment 201 → technician login/start/inspection → part usage 201 → duration → finish → reject unpaid handover → payment → handover → public history → feedback 201.

Tất cả business steps qua HTTP boundary MockMvc; không gọi service để giả HTTP. Fixture setup/DB verification/cleanup mới dùng EntityManager. Không outer @Transactional ở test, nên từng HTTP request commit như thật.

DB cuối kiểm tra customer/appointment/device/ticket/repair item/assignment/history/payment/stock/part usage/feedback. History đúng WAITING_ASSIGNMENT → ASSIGNED → INSPECTING → REPAIRING → WAITING_HANDOVER → HANDED_OVER; actor đúng ở từng history. Assignment ENDED; stock 5→3; amount=90; warranty dates có; payment PAID/CASH; feedback true.

## T. Compile, clean test, package và JAR

| Kiểm chứng | Kết quả | Evidence |
|---|---|---|
| mvn -DskipTests compile | PASS, 1.213 s | [log](final-compile.log) |
| mvn clean test | PASS, 120 tests, 1m09s | [log](final-clean-test.log) |
| mvn clean package | PASS, không skip, 120 tests, 1m32s | [log](final-clean-package.log) |
| Executable JAR | PASS, random port 58586 | [startup](final-jar-startup.log) |
| HTTP smoke | PASS 15/15 | [JSON](final-http-smoke.json) |
| JAR contents | không test classes/test signing key | [audit](jar-audit.json) |

JAR: `target/apple-repair-service-0.0.1-SNAPSHOT.jar`; SHA256 `11a6aac4661ecc3efe9251e80812b0ec7219ecc9e83b662e9e4a6f7cd4ff5784`.

Java 21, Boot 4.1.1, embedded Tomcat, Hikari MySQL 3307, Hibernate validate, SecurityFilterChain đã start. Không generated default password, circular dependency hoặc LazyInitializationException. Profile local chỉ để kiểm chứng opt-in first-admin bootstrap bằng tài khoản fixture. PID 4396 được xác minh path/start-time trước khi dừng; cổng đã đóng.

| Kiểm tra JAR thực tế | HTTP | Kết quả |
|---|---:|---|
| local bootstrap admin login | 200 | PASS |
| public catalog | 200 | PASS |
| protected without token | 401 | PASS |
| admin authorized | 200 | PASS |
| authenticated me | 200 | PASS |
| admin create receptionist | 201 | PASS |
| receptionist login | 200 | PASS |
| wrong role denied | 403 | PASS |
| right receptionist role | 200 | PASS |
| OpenAPI | 200 | PASS |
| Swagger UI HTML | 200 | PASS |
| Swagger UI JavaScript | 200 | PASS |
| Swagger configuration | 200 | PASS |
| deactivate fixture receptionist | 200 | PASS |
| old token blocked after deactivation | 401 | PASS |


## U. Swagger / OpenAPI

Thêm `org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.1`, phiên bản theo [tài liệu springdoc chính thức](https://springdoc.org/) cho Spring Boot 4. Maven resolve/compile/test/package và runtime verify tương thích với Boot 4.1.1 hiện tại.

Title/version/description, bearerAuth scheme (HTTP bearer JWT), security metadata từng operation, quyền từ @PreAuthorize, password schema writeOnly/format=password. Swagger UI có Bearer Authorize từ scheme trong OpenAPI.

`API_DOCS_ENABLED=true` để bật local: /v3/api-docs, /v3/api-docs/swagger-config, /swagger-ui/index.html và bundle JS trả 200. Mặc định docs tắt; protected business APIs vẫn yêu cầu JWT khi bật docs. Không persist token vào Swagger config.

## V. Database/schema và cleanup

Endpoint `localhost:3307/apple_repair_service`; MySQL 8.4.11. Final: **26 tables / 219 columns / 50 FK / 87 indexes**, schema diff **0**. So sánh column type/null/default/extra/collation, FK target/rules và index columns/uniqueness với snapshot trước phase. [Audit cuối](database-final-audit.json), [baseline continuation](database-continuation-baseline.json).

Không tạo Payment/Warranty/refresh-token/session/AuthAudit/notification/supplier/procurement/skill tables. Entity/Enum không đổi.

Rollback API tests tự rollback. Committed workflow dùng UUID prefix và branch/part/model IDs riêng; cleanup theo FK order và kiểm tra lại count của từng bảng sau mỗi test. JAR smoke chỉ tạo 2 users với tên ngẫu nhiên, xóa đúng 2 usernames. Không DROP/TRUNCATE/global DELETE.

Final count diff cả 26 bảng = **0**. Dữ liệu ngoài fixture được giữ. Schema audit và JAR đều dùng validate; application.yaml giữ ddl-auto=update từ baseline, không dùng update trong final verification. Auto-increment counters có thể tăng sau các fixture insert, không coi counters là business rows.

## W. JWT_SECRET và first-admin local procedure

Lỗi IDE startup trước đây do thiếu JWT_SECRET, không phải compile/test failure. Giữ fail-fast 32 UTF-8 bytes; `application.yaml` dùng `${JWT_SECRET:}`, fallback rỗng, không hard-code production secret.

Trong IDE Run Configuration, đặt JWT_SECRET bằng giá trị ngẫu nhiên đủ mạnh; terminal phải được set env trong chính process cha chạy Maven/JAR. Không đưa secret vào program arguments, source, report hoặc commit.

Ví dụ PowerShell sinh secret runtime, không in giá trị:

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$env:JWT_SECRET = [Convert]::ToBase64String($bytes)
$env:API_DOCS_ENABLED = 'true'
java -jar target/apple-repair-service-0.0.1-SNAPSHOT.jar --spring.jpa.hibernate.ddl-auto=validate
```

Tạo admin đầu tiên tại local: bật profile `local`, `BOOTSTRAP_ADMIN_ENABLED=true`, đặt `BOOTSTRAP_ADMIN_USERNAME` và `BOOTSTRAP_ADMIN_PASSWORD` qua environment của Run Configuration. Password >=10 ký tự và <=72 UTF-8 bytes. LocalAdminBootstrap chỉ tạo username chưa có qua UserService (BCrypt), không reset/đổi quyền user đã tồn tại, không log credentials. Tắt bootstrap và xóa env password sau khi tạo admin. Không có public register-admin.

Runtime verification đã dùng secret/password ngẫu nhiên, không persist; test-only signing key không nằm trong JAR. Script [Verify-Jar.ps1](Verify-Jar.ps1) tái lập smoke và cleanup, chỉ sử dụng fixture riêng.

## X. Warnings và giới hạn kiểm chứng

- Mockito/ByteBuddy dynamic agent và CDS warning trên JDK 21: warning test tooling, không failure; không disable test để che warning.
- SQL 1062/23000 trong old concurrency/retry tests là collision cố ý; toàn test vẫn PASS, không phải lỗi ứng dụng bị bỏ qua.
- Hibernate “No JTA platform”: dùng local transaction manager, không cần JTA.
- Git cảnh báo global ignore permission và LF→CRLF trong tài khoản sandbox; command-scoped safe.directory, diff --check không phát hiện whitespace lỗi.
- Test concurrency ban đầu cần unwrap Spring transaction proxy khi gắn Mockito latch; harness đã sửa, real policy/production transaction giữ nguyên. Verify-Jar harness xử lý stdout rỗng và MySQL charset utf8mb4; final run PASS.
- Các log checkpoint fail cũ có thể còn để audit lịch sử; kết luận dựa final-clean-test/final-clean-package/final-http-smoke và schema audit mới nhất.
- Public phone lookup chưa OTP/rate limiting; quyền nội bộ hiện theo role/assignment toàn hệ thống, chưa có staff-to-branch access membership ngoài model baseline.
- Test integration chạy trên DB phát triển được chỉ định. Script giữ rows ngoài fixture; cần giữ endpoint đó hoạt động để tái lập.

## Y. Deferred và final scope check

Chưa triển khai frontend, Python/FastAPI inference HTTP, ML training, deployment, Redis, Kafka, microservices hoặc refresh-token persistence. MlPredictionService baseline giữ nguyên, không mở ML public write API.

Không merge dev vào main, không push, không commit tự động. Không thêm entity/enum/table, không đổi business state machine, không rewrite các phần đã PASS. Các script Python/PowerShell trong docs chỉ audit/build verification, không là Python ML integration hoặc runtime service.

## Z. Final verdict

**MASTER REST API + SECURITY PHASE COMPLETED**

PASS: technician object authorization, transfer revoke/gain/pending/reject/target rules, part/warranty/approval role guards, actor spoof protection, Security/JWT, public/admin/receptionist/technician API, typed errors, Swagger, full HTTP committed workflow, lock concurrency, 120 tests, compile, clean test, clean package, JAR với runtime JWT_SECRET, 15 HTTP smoke checks, Hibernate validate, schema 26 tables unchanged và cleanup.

Dừng ở phase này để người dùng audit; không bắt đầu phase tiếp theo.
