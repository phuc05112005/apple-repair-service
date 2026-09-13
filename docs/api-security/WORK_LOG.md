# API / Security continuation work log

Updated 2026-09-13 (Asia/Saigon). Original spec: attachment 902062f7-85e5-4709-bc9e-acb921f9c760; continuation: dc59e388-ef37-4055-ad32-45cecbe7abe3.

No Git repository; direct source/hash audit. Preserve original 78 tests, 26 entities/tables, 19 enums. No agents, frontend, Python HTTP, deployment, schema changes.

Completed Sept 12:
- Baseline audit and compile (checkpoint-01).
- AppointmentSlotService + 6 tests, existing appointment 13 regression pass (checkpoint-02).
- UserService.create + PasswordConfig BCrypt(12) + 3 tests, master 4 regression pass (checkpoint-03).
- StatisticsService, typed DTOs, 3 ServiceTicketRepository aggregate queries; 2 unit + 2 real MySQL tests passed (checkpoint-04). receivedAt population, paidAt revenue, [from start, next-day start), distinct warranty tickets.

Partial at interruption:
- spring-security-oauth2-jose dependency, 13 auth/security/error/controller classes exist and now compile.
- Missing SecurityConfig, JWT properties/test secret, global exception handler, business controllers, object policy/facades, public-safe DTOs, Swagger, API tests, final proof/report.

Resume Sept 13:
- Narrow AppointmentSlotServiceTest(6), UserCreationTest(3), StatisticsServiceTest(2): 11 PASS, resume-gap-tests.log.
- Added Statistics integration boundary scenario. Changed StatisticsIntegrationTest to a JPA slice importing actual StatisticsService/DomainAccess and AutoConfigureTestDatabase.Replace.NONE: still REAL MySQL, no mocks, validate, rollback fixture, isolates incomplete auth wiring for this checkpoint. Full application/security context will be tested in subsequent integration checkpoints.
- Statistics integration rerun hit MySQL connection refused on 2026-09-13 (resume-statistics.log), 3 context errors before assertions. Outside-sandbox TCP probe confirmed 127.0.0.1:3307 closed. User notified asynchronously to restart the already-selected endpoint. Do not switch port or relax assertions. Statistics must pass before next checkpoint; meanwhile read-only API/DTO/authorization audit continues.

Planned implementation decisions:
Completed after user restored MySQL 3307 on Sept 13:
- Statistics 5/5 PASS (resume-statistics-restored.log), old unit + gap regression 73/73 PASS (resume-unit-regression.log).
- SecurityConfig/stateless chain, external JWT settings, CORS, local disabled bootstrap, typed GlobalExceptionHandler implemented.
- JwtTokenServiceTest 3 + original application context 1 = 4 PASS (checkpoint-05-jwt.log); SecurityIntegrationTest 6 PASS (checkpoint-06-auth-errors.log).
- Public query/command services, safe DTOs, ACTIVE repository queries, PublicController compile + MySQL API 4/4 PASS (checkpoint-07).
- Admin 7 master controllers, users/configuration/inventory controllers; actor-free stock commands. Admin API 3 + Security 6 = 9 PASS (checkpoint-08).
- ReceptionistController and AppointmentService.list/filter query compile PASS (checkpoint-09); HTTP tests running.
- Test resources disable SQL/debug noise. Host environment DEBUG overrides properties, so verification commands explicitly set DEBUG=false and SPRING_JPA_SHOW_SQL=false. No secrets in DTO toString/logs.

Remaining: technician facade + ticket-lock object policy/transfer permissions, tests, Swagger, committed full HTTP workflow, final regression/build/JAR/schema/cleanup/report.

Planned implementation decisions (retained):
- Nimbus encoder/decoder via Spring Security jose (managed 7.1.1), HS256, external JWT_SECRET >=32 UTF8 bytes, issuedAt/expiry/issuer and userId/role checks; reload DB user each bearer request. No token table/session.
- Actor from CurrentActor/SecurityContext, separate HTTP command DTOs exclude actor IDs. Do not pass HTTP body actor to old service DTOs.
- Technician operations facade @Transactional READ_COMMITTED locks ticket and verifies ACTIVE assignee in same boundary before old service call. Target transfer accept/reject allowed; no TOCTOU precheck outside transaction.
- Handover via RECEPTIONIST only (assignment ends at WAITING_HANDOVER); approval receptionist, warranty decision active technician. Document exact role matrix.
- Public lookup by phone per official spec; safe DTOs exclude internal notes/staff. Feedback ticketCode+phone, warranty repairItem+phone ownership.
- Statistics/admin filters LocalDate inclusive. Keep no capacity and active booking counts dynamic.
- springdoc-openapi-starter-webmvc-ui 3.1.1 official docs/release inspected Sept12; reverify Maven compatibility when adding. Official links https://springdoc.org/ and https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html .

Final required: checkpoint tests, original 78 + all new clean test/package no skips, executable JAR port0 validate with env JWT secret, login/public/auth/401/403/docs smoke, stop exact owned Java PID, schema 26/219/50FK/87indexes unchanged and fixture cleanup, docs/api-security/MASTER_API_SECURITY_REPORT.md A-Z + endpoint inventory; only declare COMPLETED when all pass.
