# Báo cáo dữ liệu vận hành

Ngày xác minh: 07/10/2026, múi giờ `Asia/Ho_Chi_Minh`.

## Phạm vi và an toàn dữ liệu

Canonical database là `localhost:3307/apple_repair_service`. Preflight và hậu kiểm đều ghi nhận **33 bảng, 305 cột**. Phase không migration schema, không truncate, không xóa dữ liệu người dùng và không ghi transaction giả vào database này. Các bảng customer, appointment, ticket, repair, assignment, part usage, feedback và ML prediction vẫn có 0 dòng. `inventory_lots=1` và `inventory_transactions=2` là dữ liệu có sẵn, checksum cuối lần lượt `24458074` và `2115060573`.

Script [seed-operational-data.ps1](../scripts/seed-operational-data.ps1) gọi đúng Admin REST API. Lần chạy lại tạo 0 model, 0 lịch và nhận diện đủ 46 model/120 lịch đã tồn tại, chứng minh idempotence. Script [verify-operational-data.py](../scripts/verify-operational-data.py) chỉ đọc và rollback connection.

## Audit trước thay đổi

- Device type: iPhone, iPad, MacBook, Apple Watch, AirPods.
- Trước phase có 18 model: iPhone 11, iPad 1, MacBook 1, Apple Watch 3, AirPods 2.
- `device_models` unique theo tên trong device type; naming lưu product model, không tách màu/dung lượng/mã vùng.
- Issue map theo device type qua `service_issue_device_types`, không map riêng từng model.
- Catalog map trực tiếp model + issue + service type và có thể có part. Chỉ iPhone 16 Pro có 4 catalog item.
- User dùng BCrypt; 10 tài khoản mới được xác minh hash bắt đầu `$2` và đăng nhập bằng mật khẩu rõ ở request, không lưu plaintext.
- Recommendation yêu cầu TECHNICIAN ACTIVE, cùng branch và có WORKING schedule phù hợp.

## Model được bổ sung

Tổng cộng thêm **46 model thật**, nâng tổng lên **64**:

- iPhone (14): 11/11 Pro/11 Pro Max; 12/12 mini/12 Pro/12 Pro Max; 13/13 mini/13 Pro/13 Pro Max; 14/14 Plus; 15 Plus.
- iPad (7): iPad thế hệ 9/10, iPad mini thế hệ 6, iPad Air thế hệ 4/5, iPad Pro 11 inch/12.9 inch.
- MacBook (12): Air M1; Air M2/M3 13 và 15 inch; Pro 13 inch M1; Pro 14/16 inch M1 Pro, M2 Pro; Pro 14 inch M3; Pro 16 inch M3 Pro.
- Apple Watch (7): Series 6/7/8, SE, SE thế hệ 2, Ultra, Ultra 2.
- AirPods (6): thế hệ 1/2/3, Pro thế hệ 1/2, Max.

Hậu kiểm: iPhone 25, iPad 8, MacBook 13, Apple Watch 10, AirPods 8; duplicate count **0**, malformed Unicode count **0**. Hai tên có sẵn `Apple Watch Ultra 4` và `Airpods 5` được giữ nguyên vì phase không được sửa/xóa dữ liệu người dùng.

## Issue, service, catalog và part

Không thêm/sửa issue, service type, catalog, part, price hay standard duration. Public API trả đúng issue theo device type; AirPods chỉ có Pin/Sạc/Loa và không lộ Camera. Tất cả model mới hiển thị qua API nhưng không có catalog vì không có nguồn giá/phương án đủ chắc chắn. Trạng thái chính thức là `MISSING_CATALOG_MAPPING_REQUIRES_BUSINESS_INPUT`; không bịa giá để làm booking PASS.

## Tài khoản và lịch kỹ thuật viên

- Tạo `ktv01` đến `ktv10`, role TECHNICIAN, status ACTIVE, tên tiếng Việt tự nhiên theo đặc tả.
- Mật khẩu khởi tạo theo yêu cầu phase là `123456`; database chứa BCrypt cost 12. Production phải reset ngay khi cấp tài khoản thật.
- Chia 5 tài khoản tại Táo Care Lê Văn Sỹ và 5 tại Táo Care Lê Văn Việt.
- Tạo 120 lịch hợp lệ trong cửa sổ 14 ngày: ngày chạy có ca phủ ngày để live test; các ngày Thứ 2–Thứ 7 tiếp theo là 08:00–17:00. Overlap count bằng 0.
- `ktv01` và `ktv02` đăng nhập thành công, `/auth/me` trả TECHNICIAN; Admin và Receptionist API trả 403.

Evidence local: `target/operational-data/seed-summary.json`, `database-verification.json`, `demo-seed-summary.json`.

## SERVICE CATALOG COMPLETION

Theo yêu cầu bổ sung của phase, catalog master data đã được hoàn thiện sau audit schema và API:

1. Catalog items before: 4.
2. Catalog items after: 304.
3. Parts before: 2; after: 9.
4. Models covered: 64/64 ACTIVE.
5. Issues covered: toàn bộ issue hợp lệ theo từng device type; không tạo mapping ngoài phạm vi.
6. Repair catalog items added: 294.
7. Replacement catalog items added: 6.
8. Apple Genuine options: 3 service-replacement options (iPad, Apple Watch, AirPods).
9. Pisen options: 1 (MacBook Air M1 A2337/A2389); 2 Pisen iPhone 16 Pro đã có sẵn.
10. Energizer options: 0, vì chưa có compatibility evidence cho model cụ thể trong nguồn đã kiểm tra.
11. Deji options: 3 (iPhone 13 standard, high-capacity, OLED display).
12. Bison options: 0, vì chưa có compatibility evidence đủ chắc cho model demo.
13. GX options: 0; không invent option khi chưa có nguồn model cụ thể.
14. ZY options: 0; không invent option khi chưa có nguồn model cụ thể.
15. Price range: 350.000–2.400.000 đồng cho repair/replacement mới; giá là bảng nội bộ trước discount.
16. Duration range: 30–120 phút, là standard technical duration, không phải ETA.
17. Items skipped due unsupported compatibility: replacement aftermarket ngoài các nhóm nêu trên.
18. Items requiring business input: availability/bảng giá thương mại cuối cho Apple Watch, AirPods, iPad và linh kiện Apple Genuine.
19. Booking multi-option test: iPhone 13 / Pin / REPLACEMENT có hai catalog ID và hai giá khác nhau; API giữ từng ID khi đặt.
20. Part usage test: validation hiện hành yêu cầu approved plan và part đúng catalog; không làm yếu rule.
21. Fallback standard-duration test: catalog có duration dương để Spring fallback khi ML không sẵn sàng.
22. Seed idempotence: chạy lại nhận diện model/part/catalog key, không tạo duplicate.

Chi tiết provenance, confidence, giới hạn compatibility và nguồn tham khảo nằm tại [SERVICE_CATALOG_DATA_REPORT.md](SERVICE_CATALOG_DATA_REPORT.md). Artifact CatBoost, frozen feature contract và synthetic dataset không bị sửa.
## Regression verification

- Backend: `mvn test` on isolated `apple_repair_phase16_verify_20261003_a1` (33 tables) passed with 232 tests, 0 failures, 0 errors, 1 skipped.
- ML: `python -m pytest ml/tests --basetemp target/pytest-temp` passed 102 tests. The default Windows temp root was permission-restricted; the test code and artifacts were unchanged.
- Frontend: typecheck, lint (`--max-warnings 0`) and production build all passed. Vite only reported existing Zod annotation warnings.
- Catalog seed remained idempotent and the three frozen ML SHA-256 values remained unchanged.
## FINAL LOCAL SYSTEM COMPLETION ADDITIONS

- Admin now has a read-only `Giám sát ML` route backed by `GET /api/v1/admin/ml/overview`. It reports configured status, model/contract metadata, prediction count, actual-duration coverage and training readiness from `ml_predictions`; it never retrains or invents metrics.
- Admin statistics now has a feedback statistics API at `GET /api/v1/admin/statistics/feedback`, aggregating `service_feedbacks` by date with total, satisfied, dissatisfied and satisfaction rate. Empty data is reported as zero.
- OpenAPI/security inventory and frontend route contracts were updated for both endpoints. No schema change was required.
- Final backend regression after these additions: 232 tests, 0 failures, 0 errors, 1 skipped. Frontend typecheck, lint and build remain passing. Docker Compose services remain healthy.
