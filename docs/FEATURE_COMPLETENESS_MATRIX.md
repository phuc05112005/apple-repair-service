# Ma trận mức độ hoàn thiện tính năng

Ngày chốt: 06/10/2026. `COMPLETE` nghĩa là có đường đi chức năng từ UI tới API hiện hữu; `PASS` nghĩa là có bằng chứng test tự động phù hợp. Một endpoint hỗ trợ không cần màn hình riêng không được tính là thiếu tính năng nếu use case UI không cần gọi trực tiếp.

| Use Case | Backend | Frontend | Test | Status |
|---|---|---|---|---|
| 1. Khám phá thiết bị/dịch vụ công khai | Public master-data endpoints lọc ACTIVE và quan hệ | Home, Devices, danh mục theo loại/model/vấn đề | Playwright dependency reset + catalog policy integration | COMPLETE / PASS |
| 2. Đặt lịch trực tuyến | Slot validation, booking, giá và ưu đãi authoritative | Booking wizard đủ thiết bị → dịch vụ → khách → chi nhánh/giờ → xác nhận | HTTP workflow + public API tests | COMPLETE / PASS |
| 3. Tra cứu khách hàng | Lookup appointment/ticket/warranty, response công khai tối thiểu | Lookup có loading/error/empty/detail | Playwright lookup + Public API tests | COMPLETE / PASS |
| 4. Feedback | Kiểm tra eligibility và lưu feedback | Form chỉ hiện sau `HANDED_OVER` | Playwright eligibility + full HTTP workflow | COMPLETE / PASS |
| 5. Auth và phân quyền | JWT, `/auth/login`, `/auth/me`, method security | sessionStorage, RequireRole, role home, 401/403 | Playwright role guard + SecurityIntegrationTest | COMPLETE / PASS |
| 6. Quản lý lịch hẹn | List/detail/confirm/reschedule/cancel/arrive/expire | AppointmentsPage với action theo trạng thái | Receptionist API + appointment service tests | COMPLETE / PASS |
| 7. Tiếp nhận | Appointment intake và walk-in dùng service nghiệp vụ chung | IntakePage tra/tạo khách, thiết bị, dịch vụ, mô tả/phạm vi | Transaction + Phase 1 workflow tests | COMPLETE / PASS |
| 8. Theo dõi/hủy phiếu | Ticket list/detail/history/cancel và access policy | TicketsPage, TicketWorkspacePage | HTTP/service/security tests | COMPLETE / PASS |
| 9. Gợi ý và phân công KTV | Eligibility, batch ML/fallback, ETA, revalidation, audit chọn lọc | Candidate cards, nhãn nguồn, confirm, conflict refresh | Playwright + MlSpringIntegrationTest | COMPLETE / PASS |
| 10. Kiểm tra/phương án/xác nhận | Inspection, plan update, approval recording, legal transitions | Technician one-detail page; receptionist approval | PhaseOneWorkflow/Warranty + TechnicianService tests | COMPLETE / PASS |
| 11. Linh kiện và trạng thái chờ | Part candidates/usage/reverse, wait/resume, stock locks | Chọn part phù hợp, quantity validation, wait/resume | Workflow + transaction/concurrency tests | COMPLETE / PASS |
| 12. Chuyển giao kỹ thuật viên | Request/direct/accept/reject/cancel, assignment history | Transfer controls và incoming work | HTTP transfer + rollback tests | COMPLETE / PASS |
| 13. Hoàn tất/thanh toán/bàn giao | Completion, payment summary/payment/settle-zero/handover | Payment controls theo trạng thái và giá | Playwright payment + HTTP workflow | COMPLETE / PASS |
| 14. Bảo hành | Eligibility/history/claim/decision, source linkage, remedy rules | Public lookup, receptionist history/claim, technician remedy | 9 warranty integration tests + Playwright wording | COMPLETE / PASS |
| 15. Tài khoản Admin | Create/profile/role/status/password | UsersPage đủ form/action | UserCreation/Admin HTTP tests + build | COMPLETE / PASS |
| 16. Master catalog | CRUD, activate/deactivate, safe physical delete | MasterDataPage theo nhóm, confirm delete | Admin service tests + build | COMPLETE / PASS |
| 17. Lịch làm việc và khung giờ | Employee schedules, weekly appointment schedule, date overrides, slots | SchedulesPage và SlotsPage | `ConfigurationFlowsIntegrationTest`, `AppointmentSlotServiceTest` + build | COMPLETE / PASS |
| 18. Kho | Inventory, lots, transactions, stock in/out/transfer, Excel, defective returns | InventoryPage đầy đủ filter/import/export/action | Inventory/transaction tests + frontend unit | COMPLETE / PASS |
| 19. Cấu hình và thống kê | System settings và statistics overview | SettingsPage, StatisticsPage dùng API | `AdminApiIntegrationTest`, `StatisticsIntegrationTest`, `StatisticsServiceTest` | COMPLETE / PASS |

**Kết quả: 19/19 use case mức cao có backend, frontend và bằng chứng kiểm thử; 19/19 `COMPLETE / PASS`.**
