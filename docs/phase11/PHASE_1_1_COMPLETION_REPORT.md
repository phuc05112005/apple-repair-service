# Báo cáo Phase 1.1 — kho linh kiện lỗi, ETA và hàng đợi kỹ thuật viên

Ngày kiểm chứng: 26/09/2026, Asia/Ho_Chi_Minh. Tiếp tục workspace có sẵn, giữ Phase 1; không commit/push và không triển khai Phase 2.

Trạng thái xác minh cuối: **HOÀN THÀNH PHASE 1.1 — các kiểm tra bắt buộc PASS**.

## 1. Audit trước thay đổi

Đã tái sử dụng ServiceTicket, Assignment, ServiceStatusHistory, TechnicianSchedule, RepairDurationService, SystemSetting, InventoryService, PartUsage và cơ chế quyền hiện có. Baseline Phase 1 có 29 bảng và 160 tests. defective_return_note chỉ là mô tả, chưa phải sổ tồn kho lỗi; Assignment đã có assignedAt/endedAt; history trạng thái đã đủ để tính active duration. Không tạo bảng trùng các khái niệm này.

Lượt tiếp tục kiểm tra lại mã dở, sửa việc gọi qua transaction proxy khi xử lý history cũ thiếu: calculator thuần của RepairDurationService được dùng cho dữ liệu batch, tránh việc bắt exception nhưng transaction đã bị đánh dấu rollback. Không thay semantics currentRepairMinutes.

## 2. Thiết kế defective inventory

Tách usable stock, lần xuất linh kiện và linh kiện lỗi thu hồi. BranchInventory chỉ chứa hàng có thể sử dụng. PartUsage là lần xuất hàng tốt. DefectivePartReturn là biên nhận hàng lỗi. Tồn lỗi được cộng theo chi nhánh + part, chỉ tính IN_STOCK, không thêm bảng tổng tồn lỗi thứ ba.

## 3. Schema/entity defective_part_returns

Có branch_id, part_id của linh kiện tháo ra, source_part_usage_id, quantity > 0, status, reason, note, recorded_by, received_at và người/giờ cập nhật xử lý. Unique source_part_usage_id ngăn hai biên nhận cho một PartUsage. FK truy từ usage → repair item → ticket, không lặp lại các khóa nguồn dư thừa. Index branch/part/status và CHECK quantity dương có trong canonical SQL.

Các trạng thái: IN_STOCK, SENT_TO_SUPPLIER, RESOLVED, DISPOSED. Rời IN_STOCK không còn tính đang giữ. RESOLVED/DISPOSED kết thúc xử lý. Lý do thay đổi được nối vào note, kèm giờ và trạng thái; không xây logistics nhà cung cấp.

## 4. Transaction warranty replacement

Sau khi bảo hành được chấp nhận và có phương án thay hợp lệ, usePart ghi PartUsage ACTIVE, giảm usable stock, tạo USAGE_OUT và ghi biên nhận thu hồi trong cùng transaction. Warranty replacement bắt buộc mô tả thu hồi. Test xác nhận usable 3 → 2, defective 0 → 1, giá khách = 0. Retry ghi biên nhận cho cùng usage không sinh duplicate.

Test chèn lỗi vào repository biên nhận kiểm tra lại bằng transaction mới: kho tốt không giảm, không có PartUsage hoặc InventoryTransaction dở, không có defective stock. Có ca riêng cho thay thông thường và thay bảo hành. Normal replacement không thu hồi vẫn xuất được bình thường; chỉ khi ghi nhận có thu hồi mới tạo biên nhận. Không sinh STOCK_IN/USAGE_RETURN từ linh kiện lỗi.

## 5. Admin defective inventory UI

Trang Kho linh kiện thêm phần “Linh kiện lỗi đang quản lý”, lọc chi nhánh/part, số đang giữ, bảng biên nhận, trạng thái, nguồn phiếu/hạng mục/usage, thời điểm và mô tả. Admin cập nhật xử lý bằng API, sau thành công refetch dữ liệu. KTV thấy biên nhận trên phiếu đang được phân công; không có quyền quản trị trạng thái kho lỗi.

## 6. Thiết kế ServiceTicket timing

Giữ riêng thời gian tiếp nhận, thời gian dự kiến, thời gian thực tế và thời gian bàn giao. Hệ thống có ETA ngay khi tạo phiếu nếu có lịch KTV khả dụng, không chờ assignment. Không có lịch thì trả unknown rõ ràng, vẫn tạo deadline và thời lượng tạm.

## 7. Field thêm/reuse

Thêm 9 cột nullable: assignmentDueAt; initialEstimatedStartAt, estimatedStartAt; initialEstimatedCompletionAt, estimatedCompletionAt; estimatedDurationMinutes; actualRepairStartedAt; actualRepairCompletedAt; estimateSource. Reuse receivedAt, Assignment.assignedAt/endedAt, handedOverAt và ServiceStatusHistory. Không thêm ON_TIME/DUE_SOON/OVERDUE vào business status.

## 8. service_time_estimate_histories

Snapshot gồm ticket, optional technician, start/completion/duration, STANDARD/MANUAL, reason, break snapshot, approved price snapshot, createdAt, optional createdBy. Index ticket/createdAt. Chỉ insert snapshot, không sửa hoặc xóa history cũ. Giá null vẫn unknown, không đổi thành 0.

## 9. Provisional ETA khi tạo phiếu

Contract hiện hành cộng duration của phương án chưa bị REJECTED và ưu tiên catalog thay bảo hành. Phiếu mới thiếu dịch vụ/duration hợp lệ bị từ chối; không còn default duration cố định.

## 10. ETA chưa assigned

Đọc ca WORKING của TECHNICIAN ACTIVE, đúng chi nhánh trong 90 ngày tới. Tính thời điểm hoàn thành sớm nhất sau hàng đợi đã có. Các phiếu chưa phân công giữ chỗ dự kiến FIFO theo receivedAt/ID để không cùng nhận một khoảng rảnh. Không tạo Assignment. Ca chồng lấn được gộp, khoảng ngoài ca không tính là thời gian làm việc dự kiến.

## 11. Assignment deadline

assignmentDueAt = receivedAt + UNASSIGNED_TICKET_TARGET_MINUTES, mặc định 15 phút. Test lúc 09:00 tạo phiếu có hạn 09:15; 09:16 derive quá 1 phút, status vẫn WAITING_ASSIGNMENT, số Assignment vẫn 0. Cảnh báo hoàn toàn ở giao diện/helper, không autoassign, auto-cancel hoặc scheduler.

## 12. Queue algorithm

Phiếu active technical (`INSPECTING`/`REPAIRING`) đứng trước, phần còn lại FIFO assignedAt rồi assignment ID. WAITING_PART/WAITING_APPROVAL không giữ active worker time. Giờ hoàn tất kỹ thuật gần nhất có thể tạo break trước việc kế tiếp. Tính lại các phiếu ảnh hưởng theo sự kiện. Hàng đợi KTV hiển thị thứ tự bỏ qua các phiếu tạm chờ.

## 13. Remaining workload

remaining = max(0, estimatedDurationMinutes − currentRepairMinutes). currentRepairMinutes đã gồm khoảng đóng và khoảng mở, không cộng completed lần nữa. Test 20 phút trước waiting + 25 phút sau resume = 45, remaining của định mức 60 chỉ còn 15; phiếu kế tiếp bắt đầu sau 15 + break.

## 14. Admin break configuration

Admin chỉnh “Thời gian nghỉ giữa hai thiết bị của kỹ thuật viên” qua API system_settings có sẵn. Mặc định 10 phút; 0 hợp lệ; chỉ số nguyên 0–10080. Cùng trang có hạn phân công (mặc định 15) và duration tạm (30, phải > 0). Không tự seed vào DB người dùng.

## 15. Break ảnh hưởng ETA

Break là scheduling allowance giữa hai thiết bị, không thuộc active duration. Test A xong sớm kéo B lên trước; KTV bắt đầu B sau 3 phút dù break 10 vẫn thành công, ETA tính từ actual start. Test bắt đầu sau dự kiến 10 phút derive start delay 10. Đổi setting 10 → 5 chỉ tác động lần tính sau; history cũ vẫn snapshot 10.

## 16. Actual repair start

ServiceStatusService ghi actualRepairStartedAt tại lần đầu transition INSPECTING, dùng cùng event time với status history. Không dùng receivedAt/assignedAt/estimatedStartAt thay actual; resume và đổi phương án không reset mốc này.

## 17. Waiting part/approval

Tạm chờ đặt current ETA chưa xác định vì chưa biết lúc resume, giữ initial/history. Không chiếm hàng đợi làm việc. Resume dùng remaining và không reset first actual start. Test 20 phút sửa + 60 phút chờ + 15 phút sửa cho active = 35 và waiting = 60; có ca cả waiting part và waiting approval.

## 18. Actual completion

actualRepairCompletedAt ghi khi WAITING_HANDOVER, đồng thời kết thúc assignment bằng cùng timestamp. Giữ ETA trước completion để đo trễ. Test sửa xong 14:00, bàn giao 18:00: active vẫn 60 phút, không cộng 4 giờ chờ khách.

## 19. ETA recalculate

Tạo phiếu, phân công, kiểm tra, actual start/resume, đổi phương án/giải pháp bảo hành, chờ, chuyển giao, hoàn tất/hủy và manual ETA đều nối vào timing service. Queue chạy theo ca và remaining. Phiếu đang REPAIRING khác đối tượng sự kiện giữ deadline cũ để vẫn nhận ra overdue. Completion cascade recalculates việc phía sau; completion chính phiếu không ghi đè ETA cũ.

## 20. ETA history

Sự kiện trực tiếp luôn ghi snapshot; phiếu trong cascade ghi khi ETA/duration đổi. Initial chỉ được đặt tại creation, không tự tạo lại initial cho phiếu legacy. Manual ETA yêu cầu lý do và quyền Admin/nhân viên tiếp nhận. Tính do quyết định bảo hành ghi actor null khi không có actor truyền vào, không giả danh người tạo phiếu.

## 21. Delay metrics

Endpoint đọc có assignment wait, queue wait, start delay so initial, estimated/actual technical duration, completion delay so initial và current, waiting part/approval, accepted transfer count, plan-change count, approved-price change, active duration theo KTV. Active theo KTV = (`INSPECTING` + `REPAIRING`) interval ∩ Assignment interval.

Queue wait hiện là khoảng ASSIGNED trước first actual start; inspection thuộc active technical duration. Có thể phân tích những kỳ vọng start trung gian qua history; startDelayMinutes trả trực tiếp hiện so initial. Nếu status history thiếu/đứt đoạn, metrics trả unknown cho active/waiting cùng completeStatusHistory=false. Không gắn delay với nhãn “không hài lòng”.

## 22. Receptionist UI

Danh sách phiếu có dự kiến start/completion, countdown, hạn chưa phân công và thứ tự chú ý. Sau intake vẫn mở chi tiết phiếu theo flow cũ, nơi hiển thị timing ngay. Chi tiết xem initial/current/actual và lịch sử, chỉnh manual ETA với lý do. Countdown dùng chung helper và đồng hồ trình duyệt, không request mỗi phút.

## 23. Technician UI

Danh sách có queue order, thời lượng, ETA start/completion và remaining/overdue. Chi tiết có các mốc initial/current/actual; thời lượng đã sửa dùng currentRepairMinutes một lần. Biên nhận lỗi thể hiện trên phiếu. Giữ policy cũ: sau khi assignment kết thúc, KTV không được đọc lại lịch sử qua API; nút lịch sử được ẩn ở trạng thái terminal, Admin/nhân viên tiếp nhận vẫn tra cứu được.

## 24. Admin UI

Tái sử dụng Inventory và Settings. Không dựng hệ thống quản lý kho lỗi riêng quá lớn. Settings ghi rõ tác dụng của break và việc lịch sử không bị sửa. Màu countdown xanh/vàng/đỏ có chữ giải thích; ngưỡng vàng max(15 phút, ceil(20% duration)). Bố cục timing hai cột chuyển một cột trên màn hình hẹp; bảng kho lỗi có vùng cuộn.

## 25. API thay đổi

- GET `/api/v1/admin/defective-part-returns`: Admin, lọc branchId/partId/status.
- PUT `/api/v1/admin/defective-part-returns/{id}/status`: Admin, ghi chú bắt buộc.
- GET `/api/v1/internal/service-tickets/{id}/defective-part-returns`: quyền đọc phiếu.
- GET `/api/v1/internal/service-tickets/{id}/time-estimates`: quyền đọc phiếu.
- GET `/api/v1/internal/service-tickets/{id}/timing-metrics`: quyền đọc phiếu.
- PUT `/api/v1/internal/service-tickets/{id}/eta`: Admin/nhân viên tiếp nhận.
- Ticket DTO và operational DTO thêm timing; operational DTO thêm assignedAt.
- UsePartRequest/PartUsageCommand thêm optional defectivePartId; giữ constructor tương thích code cũ.

Controller nhận/trả DTO; tính toán và transaction thuộc service. Test kiểm tra KTV khác bị 403 với lịch sử/biên nhận, nhân viên tiếp nhận không quản trị kho lỗi, KTV không chỉnh manual ETA; Admin và nhân viên tiếp nhận có quyền tương ứng.

## 26. Schema table count

Canonical schema: **31 bảng**, đúng hai domain mới. Giữ MySQL ENUM, FK, không thêm cascade delete. Cung cấp `database/phase11-additive.sql` để áp dụng một lần trên schema Phase 1 chưa có thay đổi tương ứng. Không import canonical schema lên database nghiệp vụ.

## 27. Backend tests

**mvn test: 177 tests, 0 failures, 0 errors, 0 skipped — PASS**, hoàn tất lúc 21:02:23 ngày 26/09/2026. Log: `target/phase11/final-tests.log`.

Mới: PhaseElevenTimingIntegrationTest (13 ca) với MutableClock Việt Nam. Bổ sung vào PhaseOneWorkflowIntegrationTest (normal collected parts, phân quyền API), PhaseOneWarrantyIntegrationTest (stock/biên nhận/idempotency/status), ApplicationTransactionsIntegrationTest (hai ca lỗi insert biên nhận normal/warranty và đọc lại transaction khác). Cập nhật constructor mock và cleanup test có FK mới. Không thay baseline assertion nghiệp vụ để né lỗi.

Lần đầu chạy trong sandbox bị connection refused; kiểm tra ngoài sandbox xác nhận 3307 hoạt động, sau đó chạy trên database test với quyền kết nối phù hợp. Các lượt trung gian phát hiện fixture service type trùng tên và phiếu bảo hành thiếu receivedCondition; đã sửa fixture/cleanup, giữ nguyên validation bắt buộc và chạy lại toàn suite. Các lỗi trung gian không được tính thành PASS.

## 28. Maven package

**mvn package PASS**, chạy lại **177 tests, 0 failures, 0 errors, 0 skipped**, tạo executable JAR `target/apple-repair-service-0.0.1-SNAPSHOT.jar` lúc 21:03:34 ngày 26/09/2026. Log: `target/phase11/final-package.log`.

Không bỏ qua test khi đóng gói. Chạy JVM test với `-Duser.timezone=UTC`, application/business clock vẫn Asia/Ho_Chi_Minh. Không chạy backend JAR mới lên database nghiệp vụ trong lượt này.

## 29. Frontend verification

**Typecheck PASS; lint PASS (0 warnings); build PASS; unit tests 5/5 PASS.** Log: `target/phase11/frontend-typecheck.log`, `frontend-lint.log`, `frontend-build.log`, `frontend-unit.log`.

Bổ sung timing.test.mjs cho màu/ngưỡng/countdown/overdue, hạn phân công và biên ngày UTC/Vietnam. Business-time tests Phase 1 tiếp tục giữ nguyên. Không bổ sung dependency. Cảnh báo annotation từ Zod khi build là cảnh báo dependency, không lỗi ứng dụng. Chưa tuyên bố kiểm chứng trực quan toàn viewport bằng browser automation.

## 30. Blank DB validation

Đã tạo database trống `apple_repair_phase11_verify_7e3cbf9a54`, import canonical SQL: 31 bảng, 0 row ban đầu. Các Spring integration test dùng ddl-auto=validate trên database này. Test rollback hoặc cleanup fixture đúng khóa/prefix; không DROP/TRUNCATE hay tắt FK.

Sau test và package: **31 bảng, tổng 0 bản ghi**. Không còn fixture trong database kiểm chứng cuối.

Bằng chứng local: `target/phase11/database-before-verification.json`, `database-after-verification.json`, `test-db.txt`. Các database thử từ lượt trước được giữ, không tự DROP.

## 31. User database safety

Không INSERT/UPDATE/DELETE fixture hoặc chạy migration trên database nghiệp vụ. Script kiểm chứng chỉ SHOW TABLES/CHECKSUM TABLE ở database đó. Các lệnh CREATE/import và test ghi dữ liệu chỉ ở database có tên test riêng.

Checksum toàn bộ bảng database nghiệp vụ giữa hai mốc đọc của lượt kiểm chứng ngày 26/09 **khớp nhau**. Kết luận này áp dụng cho cửa sổ kiểm chứng hiện tại, không khẳng định dữ liệu không thay đổi từ ngày 22/09 đến nay.

Bằng chứng local: `target/phase11/user-db-before-20260926.txt`, `user-db-after-20260926.txt`. Không đưa tên/SĐT khách vào báo cáo. Snapshot ở checkpoint 22/09 không được dùng để khẳng định dữ liệu không đổi suốt nhiều ngày.

## 32. Giới hạn còn lại

- ETA theo trạng thái ticket và ca làm, không đo thao tác từng item; thiếu ca trong 90 ngày thì unknown. Timer không tự nhận biết KTV sửa nhiều máy đồng thời.
- Bộ tính batch các assignment/phiếu đang mở, chưa benchmark tải lớn hoặc kiểm chứng đa instance. Cần đánh giá tải/thứ tự khóa nếu triển khai quy mô lớn.
- Lịch sử cũ không có ETA/biên nhận vẫn thiếu, không backfill giả. Kho lỗi cũ chỉ có note không được tự chuyển thành số lượng tồn.
- Linh kiện tháo khác mã mặc định có thể truyền defectivePartId qua API; form hiện dùng part nguồn bảo hành, hoặc part đang thay nếu không có nguồn. Không có UI chọn mã tháo khác trong phase này.
- Chưa có workflow logistics/nhà cung cấp, chỉnh biên bản lỗi terminal hay bảng lịch sử logistics riêng.
- Countdown phụ thuộc đồng hồ trình duyệt đúng. Xác minh frontend hiện là compile/lint/build/unit, không toàn bộ browser viewport.
- Chưa áp dụng additive schema trên database nghiệp vụ; cần đối chiếu schema và áp dụng trước khi chạy bản mới nếu dùng validate. Nếu Hibernate update đã tạo cột thì không chạy lại script một cách máy móc.

## 33. Sẵn sàng cho Phase 2 ML

Core đã có dữ liệu thời gian tách queue/break/wait/active, initial/current ETA/history, completion và active theo assignment. Có thể bắt đầu thiết kế dataset contract sau khi người dùng xem báo cáo và yêu cầu. Chưa chứng minh đủ dữ liệu thật để huấn luyện hoặc đo chất lượng dự đoán. Cần chốt prediction time, đơn vị mẫu, xử lý thiếu history/nhiều KTV và split tránh leakage.

Không train model, sinh synthetic dataset, tạo notebook, chạy FastAPI, gọi Python, thêm prediction UI hoặc đổi recommendation sang ML. Dừng ở Phase 1.1.

## Danh mục file và bằng chứng

Danh sách file mới/sửa theo phạm vi phase tại [PHASE_1_1_FILES.md](PHASE_1_1_FILES.md). Quy tắc chi tiết tại [SERVICE_TIMING_RULES.md](SERVICE_TIMING_RULES.md). Log test/package/frontend nằm trong `target/phase11/`; đây là bằng chứng local, không tự commit vào git.
