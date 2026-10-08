# Final Local System Completion Report

Date: 07/10/2026, Asia/Ho_Chi_Minh. Branch: `dev`.

## Scope

The project remains a React/Vite frontend, Spring Boot REST backend, MySQL canonical schema and a separate FastAPI inference helper. No AWS, Oracle, VPS deployment, schema migration, model retraining or commit/push was performed.

## Completed additions

- Admin ML monitoring is available at `GET /api/v1/admin/ml/overview` and route `/internal/admin/ml`. It reads prediction rows and exposes model/contract metadata, actual-duration coverage and training readiness without inventing metrics or running retraining.
- Admin statistics now includes real feedback aggregation at `GET /api/v1/admin/statistics/feedback`. The Statistics page displays total feedback, satisfied/dissatisfied counts and satisfaction rate for the selected date range.
- OpenAPI security inventory was updated for both read-only admin endpoints. No new table or column was needed.
- Repository hygiene now ignores Python caches, Playwright output, coverage and local logs. Existing source, tests, schema, seed scripts, ML artifacts and documentation remain trackable.

## Data and safety

Canonical `localhost:3307/apple_repair_service` remains 33 tables and 305 columns. Master/catalog data is complete at 64 active models, 304 catalog items and 9 parts. No customer, appointment, ticket, assignment, part usage, feedback or ML prediction fixture was inserted into canonical. Only authorized catalog stock-in demo rows exist.

The CatBoost artifact, frozen feature contract and synthetic dataset were not changed. Their SHA-256 values remain documented in the operational and catalog reports.

## Verification

- Maven: 232 tests, 0 failures, 0 errors, 1 skipped (optional live smoke), BUILD SUCCESS.
- Python ML: 102 tests passed.
- Frontend: typecheck passed, ESLint passed with zero warnings, production build passed.
- Frontend unit tests: 17/17 passed.
- Playwright: 10/10 passed.
- Docker Compose: MySQL, Spring Boot, FastAPI and React/Nginx containers healthy.
- Full local stack smoke: admin login through `127.0.0.1:8088` succeeded; ML overview returned live/readiness `UP`, and feedback statistics returned real demo-db counts.
- OpenAPI security inventory test passed after adding the two admin endpoints.

## Honest limitations

The duration model remains `EXPERIMENTAL_DEMO`, synthetic-trained and not production validated. The admin dashboard reports “not enough real data” when prediction rows with actual technical duration are absent. It does not claim satisfaction prediction, automatic retraining or automatic technician assignment. Browser E2E uses the existing contract-mock suite; full cross-process browser validation remains a separate smoke concern.

**Gate: LOCAL-COMPLETE / DEMO-READY / FUNCTIONALLY COMPLETE for the current local scope.** Deployment remains a later phase.
# Final Admin ML + Feedback Analytics

The admin feedback endpoint now includes a read-only branch breakdown aggregated from service feedback and ticket branch relationships. Empty periods return an empty branch list; no demo rows are generated.
