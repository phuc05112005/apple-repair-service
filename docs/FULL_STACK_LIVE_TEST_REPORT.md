# Báo cáo hoàn thiện Operational Data + Local Full Stack + Deployment Readiness

Ngày kiểm chứng: 07/10/2026, `Asia/Ho_Chi_Minh`. Không commit, push, release, tag hoặc deploy VPS.

## 1. Database audited

Canonical `localhost:3307/apple_repair_service`: 33 bảng, 305 cột. Audit schema, master, user, branch, schedule, recommendation và booking dependency hoàn tất trước khi ghi.

## 2. Existing device types

iPhone, iPad, MacBook, Apple Watch, AirPods.

## 3. Existing model counts

Trước phase: 18 tổng (iPhone 11, iPad 1, MacBook 1, Apple Watch 3, AirPods 2). Sau phase: 64 tổng (25/8/13/10/8 theo thứ tự trên).

## 4. Models added

46 model Apple thật; danh sách đầy đủ trong [OPERATIONAL_DATA_REPORT.md](OPERATIONAL_DATA_REPORT.md).

## 5. Models skipped

Không duplicate; lần chạy idempotence skip đủ 46 model đã tồn tại. Dữ liệu cũ có tên đáng ngờ được giữ nguyên thay vì tự ý sửa/xóa.

## 6. Issue tables changed or unchanged

Không đổi. Mapping vẫn theo device type; public API không trả issue sai loại.

## 7. Service tables changed or unchanged

Không đổi service type hay service issue.

## 8. Catalog mappings changed or unchanged

Không đổi catalog/part/price/duration. Model mới mang trạng thái `MISSING_CATALOG_MAPPING_REQUIRES_BUSINESS_INPUT`; chỉ iPhone 16 Pro có 4 catalog item.

## 9. Technician accounts created

`ktv01..ktv10`, TECHNICIAN ACTIVE, BCrypt cost 12, đăng nhập ban đầu `123456` theo yêu cầu phase; không lưu plaintext.

## 10. Technician branch assignment

5 KTV tại branch 1070 và 5 KTV tại branch 1071.

## 11. Technician schedules

120 WORKING schedules trong 14 ngày, overlap 0. Seed lần hai tạo 0 dòng.

## 12. Login verification

`ktv01` và `ktv02`: login/JWT/`auth/me` PASS; Admin API và Receptionist API trả 403.

## 13. Model → issue verification

PASS qua public API cho một model mới của cả 5 loại; AirPods không có Camera.

## 14. Model → service verification

Luồng trả danh sách rỗng đúng contract cho model chưa có catalog. Không tạo giá/phương án giả; limitation được hiển thị rõ.

## 15. Recommendation candidate verification

Live ticket trả ít nhất 5 candidate với technician, availability, workload, queue, predicted/fallback minutes, start/completion ETA và warning. UI không auto-select; nhân viên chọn thủ công.

## 16. Demo DB strategy

Transaction fixture chỉ ở `apple_repair_service_demo` trong Docker volume. Ma trận có đủ 5 appointment state, 8 ticket state, positive payment, settle-zero warranty, inventory/part usage, feedback, timing và multiple workload.

## 17. Docker architecture

Frontend edge/internal; backend, ML và MySQL chỉ internal. Named MySQL volume, healthcheck, dependency health, restart policy và timezone Việt Nam.

## 18. Frontend container

Node 22 multi-stage build sang Nginx; SPA fallback và same-origin `/api` proxy. Chỉ bind `127.0.0.1:8088`.

## 19. Backend container

Maven/Java 21 multi-stage; non-root JRE Alpine; config datasource/JWT/CORS/ML/profile qua env, `ddl-auto=validate`.

## 20. FastAPI container

Python runtime non-root, nạp CatBoost artifact hiện có; `/health/live` và `/health/ready` healthy; không retrain.

## 21. MySQL container

MySQL 8.4, utf8mb4, UTC+7, named volume; không publish host port.

## 22. Docker Compose result

Local Compose config PASS, image build PASS, production Compose config PASS. Bốn service đang running healthy.

## 23. Healthcheck result

MySQL, ML, backend, frontend đều `healthy`; frontend/public API reachable 200.

## 24. Real ML path result

PASS: browser → React → Spring → FastAPI → MySQL → CatBoost → Spring → React. Candidate có positive prediction/ETA; chỉ prediction của candidate đã chọn được lưu; assignment vẫn thủ công.

## 25. ML fallback result

PASS khi FastAPI stopped: 5 candidate, tất cả `STANDARD_DURATION_FALLBACK`, 90 phút, ETA hợp lệ, assignment ACTIVE bằng manual selection. Ticket fallback có `ml_predictions=0`; FastAPI sau đó được bật lại và healthy.

## 26. Live E2E result

1/1 PASS, 54.1 giây ở lần chạy cuối. Luồng đi từ booking → confirm → arrived → intake → recommendation → manual assignment → inspect → wait/resume → part usage → finish → payment → handover → lookup → feedback, không mock API.

## 27. Backend regression

Maven: **232 tests, 0 failures, 0 errors, 1 optional live smoke skipped — BUILD SUCCESS**. Bổ sung regression cho việc giữ hạng mục warranty claim qua inspection plan.

## 28. Python regression

**102/102 PASS**.

## 29. Frontend regression

Typecheck PASS; lint PASS 0 warning; unit **17/17 PASS**; production build PASS.

## 30. Existing Playwright result

Mock suite **10/10 PASS** trong 13.4 giây, chạy trên production frontend container bằng `PLAYWRIGHT_EXTERNAL_BASE_URL` để không tạo mock webserver thứ hai.

## 31. Dependency security result

`npm audit`: 18 high, 0 critical; đều thuộc dev/build toolchain. Không có safe direct upgrade do npm đề xuất, không force upgrade. Xem [DEPENDENCY_SECURITY_REVIEW.md](DEPENDENCY_SECURITY_REVIEW.md).

## 32. Deployment readiness

Production Compose, env example, host Nginx example, deploy/rollback script, runbook và backup/restore guide đã sẵn sàng. Chưa deploy thật.

## 33. CD readiness

Manual GitHub workflow verify → build/test → GHCR → SSH → healthcheck → rollback đã được chuẩn bị; YAML parse PASS.

## 34. Domain/VPS requirements

`VPS_DEPLOYMENT = PENDING_EXTERNAL_INFRASTRUCTURE`. Cần VPS, SSH, production environment secrets, GHCR read credentials, domain DNS và TLS certificate.

## 35. Files created

Dockerfiles/backend/frontend/ML, Compose local/production, Nginx configs, env examples, demo master SQL, operational/demo/fallback scripts, live Playwright config/spec, CD workflow, deploy script và 9 tài liệu phase.

## 36. Files modified

Application datasource/env config, local/docker admin bootstrap, user password validation/UI, ML integration/recommendation/ETA contracts and tests, warranty inspection matching, frontend recommendation/ticket UI/tests, package scripts/lock và gitignore. Workspace còn chứa thay đổi từ các phase trước; không coi toàn bộ `git status` là phát sinh riêng phase này.

## 37. Known limitations

Model mới chưa có catalog/giá; ML vẫn `EXPERIMENTAL_DEMO`, synthetic-trained và chưa production validated. `npm audit` còn 18 high trong tooling. Demo initial password ngắn chỉ dùng đúng yêu cầu phase và phải reset khi dùng thật.

## 38. Remaining TODO

Business owner cung cấp catalog/price/duration cho model mới; cấp VPS/domain/secrets; review migration/backup; xử lý dependency khi upstream có safe release; chạy production smoke sau deploy được phê duyệt.

## 39. Gate result

**OPERATIONAL DATA + LOCAL FULL-STACK + DEPLOYMENT READINESS GATE: PASS**

ML checksums không đổi:

- CatBoost `147B5153BCEA0E56651D5535B2B09184208C0E832CC2DE42E01657D9B55CF1AE`
- Feature contract `18D6EB1C0BDAC678473FB87F79024AFADCFD10B5F271E97B82394AC594282959`
- Synthetic dataset `A0D7BFD0ACE36C7FB940A62203DCD8EF75875391455F65B11E52DF66E3E43C2F`

Canonical hậu kiểm: duplicate 0, malformed Unicode 0, transaction fixture 0, schema không đổi. Không commit/push.
