# Báo cáo hoàn thiện Phase 1 — Apple Repair Service

Ngày kiểm chứng: 22/09/2026, Asia/Ho_Chi_Minh. Tiếp tục từ workspace hiện tại; không làm lại project và không triển khai Phase 2.

## 1. Điều chỉnh approval

Đã bỏ quy tắc tự động chuyển mọi thay đổi dịch vụ/tăng giá sang WAITING_APPROVAL. Khi có phương án mới, nhân viên ghi nhận hình thức khách đã đồng ý và lưu để tiếp tục REPAIRING. Nếu chưa liên hệ được khách, nhân viên chủ động chọn tạm chờ. Cờ API `requiresCustomerApproval=true` nay có nghĩa chủ động chờ liên hệ, không phải bắt khách duyệt trên web.

Không cho dùng riêng `false` để âm thầm duyệt một phương án mới: cần ghi nhận phương thức xác nhận nội bộ. Phương án không đổi đã được đồng ý có thể tiếp tục. Hạng mục cũ bị thay được giữ REJECTED cùng snapshot để truy vết, không xóa lịch sử. Hạng mục đã xuất linh kiện hoặc đã được chấp nhận bảo hành không thể bị âm thầm bỏ/đổi giá qua cập nhật phương án.

## 2. Trực tiếp, điện thoại và cho phép trước

`ConfirmationMethod`: DIRECT, PHONE, PRE_AUTHORIZED. RepairItem lưu phương thức, người ghi nhận, thời điểm và ghi chú. Phiếu có `authorizedScope` riêng để lưu phạm vi/điều kiện khách cho phép khi giao máy. PRE_AUTHORIZED chỉ được dùng khi phiếu có phạm vi này; nội dung là ghi chú nghiệp vụ do nhân viên đối chiếu, không tự diễn giải văn bản thành hạn mức máy tính.

Kỹ thuật viên đang được phân công có thể cập nhật phương án hoặc ghi nhận quyết định qua endpoint nội bộ riêng. Kỹ thuật viên khác bị 403. Nhân viên tiếp nhận vẫn có endpoint ghi nhận ý kiến khách. Đường `resume-repair` chỉ dùng khi WAITING_PART, không bỏ qua xác nhận ở WAITING_APPROVAL. Không có customer login, OTP hoặc hành động xác nhận trên website.

## 3. Walk-in chưa có dịch vụ

Tiếp nhận chấp nhận danh sách dịch vụ rỗng. Lưu riêng vấn đề khách mô tả, tình trạng khi nhận và phạm vi cho phép trước. Kỹ thuật viên mở phiếu, bắt đầu INSPECTING rồi chọn catalog REPAIR/REPLACEMENT phù hợp. Test đi qua walk-in → phân công → inspection bằng API; test khác xác minh phương án theo PRE_AUTHORIZED đi thẳng REPAIRING và sau đó đổi từ sửa sang thay trong phạm vi đã ghi nhận. Mô tả gốc không bị ghi đè bởi kết luận kỹ thuật.

## 4. Bảo hành theo RepairItem

Mỗi hạng mục có nguồn bảo hành, quyết định và phương án bảo hành riêng. Không có quy tắc miễn phí cả phiếu. WarrantyRemedy phân biệt REPAIR với REPLACEMENT; thay bảo hành gắn thêm catalog thay linh kiện phù hợp model và vấn đề của hạng mục nguồn.

## 5. Bảo hành hợp lệ

Chấp nhận bảo hành đặt finalPrice của đúng hạng mục về 0. Sửa bảo hành không bắt buộc PartUsage. Thay bảo hành yêu cầu PartUsage phù hợp và ghi nhận linh kiện lỗi thu hồi. Khi hoàn tất, giữ kỳ bảo hành của hạng mục nguồn. Test xác minh sửa miễn phí có thể hoàn tất và bàn giao với tổng 0.

## 6. Bảo hành bị từ chối

Lưu lý do từ chối trên hạng mục gốc. Kỹ thuật viên bỏ hạng mục này khỏi phương án đang thực hiện và thêm REPAIR/REPLACEMENT trả phí sau trao đổi DIRECT/PHONE hoặc trong phạm vi đã cho phép. Bản ghi từ chối vẫn được giữ. Backend chặn hoàn tất nếu còn hạng mục bảo hành bị từ chối đang được chọn thực hiện; không dùng giá bảo hành cũ làm giá dịch vụ thay thế.

Test: màn hình vỡ do rơi → từ chối → thêm thay màn hình trả phí → ghi nhận linh kiện → tổng 900.000 đồng.

## 7. Phiếu vừa bảo hành vừa tính phí

Cho cập nhật phương án tại INSPECTING, REPAIRING và WAITING_APPROVAL khi chưa thanh toán. Giao diện kỹ thuật viên cho thêm dịch vụ phát sinh. Test giữ nguyên ID/quyết định/giá 0 của hạng mục màn hình bảo hành, thêm pin trả phí 900.000 đồng, xuất pin, hoàn tất, thu đúng 900.000 và bàn giao. Tổng tiền chỉ cộng các hạng mục APPROVED; hạng mục bị thay thế không bị tính lại.

## 8. Kho khi thay bảo hành

Catalog chỉ mô tả phương án. Chọn catalog hoặc ghi nhận quyết định bảo hành không xuất kho. Khi ghi PartUsage, transaction khóa phiếu, hạng mục, linh kiện và tồn kho; trừ đúng quantity của linh kiện tốt, tạo USAGE_OUT. Test tồn kho 3 → 2 khi thay một linh kiện bảo hành, khách vẫn trả 0.

## 9. Linh kiện lỗi thu hồi

Giải pháp tối thiểu bổ sung `part_usages.defective_return_note`, ghi nhận nguyên tử cùng lần thay bảo hành. Note mô tả linh kiện tháo ra/mã nhận dạng/vị trí lưu; số lượng, người ghi nhận, thời điểm dùng chung quantity, recordedBy và usedAt của PartUsage. Liên kết RepairItem → warrantySourceItem giữ nguồn gốc hạng mục.

Đây là bản ghi tiếp nhận linh kiện lỗi, không phải tồn kho khả dụng. Không có STOCK_IN/USAGE_RETURN cho linh kiện lỗi. Không cho hoàn tác lần thay đã ghi nhận thu hồi lỗi bằng chức năng hoàn linh kiện tốt. UI hiển thị rõ thu hồi lỗi và thời điểm. Chưa xây kho lỗi độc lập, luồng trả nhà cung cấp, xử lý tiêu hủy hoặc sửa biên bản thu hồi; đây là giới hạn chủ ý để không thiết kế lại inventory.

## 10. Giá null

PaymentService kiểm tra toàn bộ hạng mục APPROVED trước khi cộng tổng. Giá null trả lỗi: “Phiếu còn hạng mục chưa xác định giá. Vui lòng cập nhật giá trước khi thanh toán.” Thanh toán, chốt tổng 0 và bàn giao đều đi qua phép tính này. Giá 0 tường minh vẫn hợp lệ; không chuyển null thành 0. Form phương án yêu cầu giá cho dịch vụ thông thường.

## 11. Kiểm tra PartUsage

Hoàn tất REPLACEMENT yêu cầu ít nhất một PartUsage ACTIVE, quantity > 0 và đúng part theo catalog. REVERSED không được tính. Thay bảo hành áp dụng cùng điều kiện với catalog thay bảo hành và phải có biên nhận lỗi. API xuất linh kiện chặn sai part. Frontend sửa enum sử dụng thực tế từ USED thành ACTIVE và lọc lựa chọn linh kiện theo phương án.

Các test bao phủ thiếu usage, sai part, reverse rồi xuất lại, không tăng kho sử dụng bởi linh kiện lỗi. Admin không thể xóa catalog đang được tham chiếu bởi phương án thay bảo hành; FK và kiểm tra reference cùng bảo vệ quan hệ này.

## 12. Duration

Backend giữ semantics: completedRepairMinutes là các khoảng đã đóng; currentRepairMinutes đã gồm phần đã đóng và khoảng REPAIRING đang mở. Frontend chỉ hiện currentRepairMinutes. Test: completed = 20, current = 25; hiển thị tổng 25, không cộng thành 45. Thời gian chờ không được cộng vào active repair duration.

## 13. Booking validation

CatalogPolicy dùng chung kiểm tra master còn ACTIVE, model/device type đúng, issue áp dụng cho device type, catalog đúng model, service type hợp lệ và REPLACEMENT có part ACTIVE. AppointmentService kiểm tra slot OPEN, thời gian phù hợp và branch ACTIVE. API nhận slot ID rồi tự xác định branch, không nhận branch/issue/type tùy ý từ client. Test payload cố nhét các ID ngoài contract nhận 400; master bị ngừng hoạt động hoặc quan hệ sai bị từ chối. Không thêm capacity hoặc khóa slot theo lượt đặt.

## 14. Ngày giờ Việt Nam

Clock và timezone nghiệp vụ dùng Asia/Ho_Chi_Minh; thiết lập timezone trước Hibernate timestamp generators. LocalDate là ngày lịch; LocalDateTime là thời gian nghiệp vụ UTC+7. Frontend diễn giải timestamp không offset theo +07:00, dùng helper ngày Việt Nam và cộng ngày lịch, bỏ toISOString().slice(...) tại các form ngày liên quan. Test backend chạy cả khi JVM khởi tạo với -Duser.timezone=UTC; frontend kiểm tra biên ngày ở UTC, Việt Nam, Los Angeles.

## 15. Schema

`database/schema.sql`: 29 bảng, đầy đủ appointment_weekly_schedules, appointment_date_overrides, service_issue_device_types. Bổ sung nullable TEXT cho mô tả gốc/phạm vi cho phép, enum confirmation_method/warranty_remedy, FK warranty_replacement_catalog_id và defective_return_note. Không thêm bảng kho mới; không thêm cascade delete; giữ ENUM và FK.

Đã CREATE một database test trống `apple_repair_phase1_test_bad13a533b`, import canonical schema và chạy Spring với ddl-auto=validate thành công. Không DROP, truncate hoặc tắt FK. Database test cuối có 29 bảng, tổng 0 bản ghi. Có các database thử trống từ những lần dựng trước, được giữ vì không được DROP.

Không chạy migration lên database người dùng. Khi khởi động backend bản cập nhật với cấu hình local ddl-auto=update hiện có, Hibernate sẽ bổ sung cột/FK nullable. Nếu môi trường dùng validate, cần áp dụng thay đổi additive trước. Không import toàn bộ schema.sql vào database đã có dữ liệu. Không backfill giả nội dung xác nhận/bảo hành cho lịch sử cũ.

## 16. Các file thay đổi

Các nhóm chính của Phase 1:

- Backend: ServiceTicketService, WarrantyService, InventoryService, PaymentService, RepairItemService, TechnicianOperationsService, ServiceStatusService, AppointmentService, CatalogPolicy, TimeConfig, AdminReferenceRepository.
- API/entity: TechnicianController, ReceptionistController; ServiceTicket, RepairItem, PartUsage; ConfirmationMethod, WarrantyRemedy; DTO inspection/approval/intake/warranty/usage và response/EntityResponses.
- Frontend: InspectionPlanEditor, ConfirmationFields, WarrantyDecisionPanel; IntakePage, TechnicianTicketPage, TicketWorkspacePage; API contracts/client wrappers, labels, global.css, format.ts và các form ngày liên quan.
- Test: PhaseOneWorkflowIntegrationTest, PhaseOneWarrantyIntegrationTest, BusinessTimeTest; cập nhật test giá/booking/transaction/phân quyền/OpenAPI; frontend business-time.test.mjs.
- Schema/tài liệu/CI: database/schema.sql, database/README.md, TEMPORAL_CONVENTIONS.md, báo cáo này, ml/, CI và cấu hình test DB riêng.

Danh mục toàn workspace tại [WORKSPACE_FILE_INVENTORY.txt](WORKSPACE_FILE_INVENTORY.txt). Danh mục bao gồm cả thay đổi có sẵn từ checkpoint trước; không coi tất cả là thay đổi mới trong lượt này. Không commit hoặc push.

## 17. Backend test và đóng gói

- Maven test: **160 tests, 0 failures, 0 errors, 0 skipped — PASS**.
- Maven package: chạy lại **160/160 PASS**, tạo executable JAR thành công lúc 10:14:41 ngày 22/09/2026.
- Package bao gồm kiểm thử bổ sung về đổi sửa → thay theo PRE_AUTHORIZED, quyền kỹ thuật viên khác, chặn resume bỏ qua chờ xác nhận và reference catalog thay bảo hành.
- Tất cả integration test dùng SPRING_DATASOURCE_URL trỏ database test riêng; cấu hình test mặc định cũng không trỏ database nghiệp vụ.
- Log: `target/phase1-tests.log`, `target/phase1-package.log`; kết quả từng suite ở `target/surefire-reports/`.

## 18. Frontend

Typecheck PASS; lint PASS với 0 warnings; build PASS; unit test ngày giờ 2/2 PASS. Vite có cảnh báo annotation từ dependency Zod, không phải lỗi ứng dụng. Không bổ sung dependency frontend cho các chức năng này. Đây là kiểm chứng compile/lint/build và unit/API, chưa phải xác nhận trực quan từng viewport bằng browser automation.

## 19. Database người dùng

Không thực hiện INSERT/UPDATE/DELETE hoặc migration trên database nghiệp vụ trong lượt này. Không tạo fixture ở đó, không xóa dữ liệu người dùng.

Đối chiếu checksum lịch sử từ 21/09 **không khớp** ở customers, customer_devices, service_tickets, repair_items, service_status_histories. Đọc tổng hợp cho thấy một phiếu và dữ liệu liên quan được tạo lúc **21:03:36 ngày 21/09**, sau mốc kiểm chứng trước (20:53) và trước lượt hôm nay. Không quy kết người tạo khi không có bằng chứng; đã giữ nguyên dữ liệu đó. Hai phép kiểm tra checksum cuối hôm nay khớp nhau.

Bằng chứng local: `target/phase1-user-db-before.txt`, `phase1-user-db-after.txt`, `phase1-user-db-checksum-difference.json`, `phase1-data-verification.json`. Không ghi tên/SĐT khách vào báo cáo. Không khẳng định database từ hôm qua đến nay hoàn toàn không đổi.

## 20. Khung ml/

Giữ notebooks/, data/raw/, data/processed/, data/synthetic/, src/, models/, api/, tests/, requirements.txt, README.md, .gitignore. Các thư mục rỗng có .gitkeep. README mô tả Spring Boot sở hữu authorization/validation/business rules/DB writes/quyết định cuối; Python tương lai chỉ nhận features và trả prediction. Regression dự kiến thời lượng REPAIRING theo kỹ thuật viên; classification dự kiến nguy cơ không hài lòng, không dùng feedback làm feature.

## 21. Những gì cố ý chưa làm

Chưa training, sinh dataset lớn/synthetic, tạo notebook thực nghiệm/model artifact, chạy FastAPI hay tích hợp ML. Không đổi thuật toán recommendation/workload/assignment. Không thêm prediction UI, customer online approval/login/OTP, capacity, auto-expire scheduler, technician skill profile hoặc deep-learning framework. Không triển khai kho lỗi độc lập, không đổi toàn project sang migration framework.

## TRẠNG THÁI SẴN SÀNG CHO PHASE 2

- **Core workflow:** các luồng thuộc phạm vi Phase 1 đã qua API/service/integration tests; cần chạy backend/frontend bản mới để sử dụng tại máy người dùng. Chưa tuyên bố kiểm thử trực quan toàn ứng dụng.
- **Warranty mixed billing:** đúng theo kiểm thử 0 + 900.000 = 900.000, bảo toàn hạng mục nguồn và trừ đúng linh kiện.
- **Customer confirmation:** không yêu cầu bất kỳ thao tác website nào của khách. Nhân viên ghi nhận DIRECT/PHONE/PRE_AUTHORIZED.
- **Inventory:** thay thông thường và thay bảo hành đều yêu cầu usage thật; thu hồi lỗi không trở lại usable stock. Giới hạn cơ chế thu hồi nêu ở mục 9.
- **Blocker dữ liệu trước ML:** lịch sử hiện có quá ít để đánh giá mô hình thực tế; cần chốt đơn vị mẫu theo ticket/assignment, prediction time, nhãn, history thiếu, phiếu nhiều kỹ thuật viên và split chống leakage. Không giả lập nhãn thật hoặc tự điền lịch sử cũ. REPAIRING là thời gian trạng thái, chưa phải timer thao tác theo từng item.
- **Có thể bắt đầu dataset contract + synthetic data + notebook ở phase kế tiếp:** có. Synthetic chỉ chứng minh pipeline, không chứng minh độ chính xác vận hành. Môi trường Python/dependency phải được kiểm chứng và pin tại Phase 2. Chưa đủ căn cứ để huấn luyện/triển khai mô hình dựa trên dữ liệu thực tế.

Dừng ở Phase 1. Không tự động bắt đầu Phase 2.
