# Runtime Inference Status

Date: 06/10/2026, Asia/Ho_Chi_Minh.

**GATE PASS — internal Python runtime and FastAPI transport are complete.**

Verification: 102/102 tests passed (54 existing + 48 new, including 20 API cases); Python compile passed; canonical live/readiness/model-info smoke passed; the 33-table database checksum digest was unchanged.

The service loads the unchanged `EXPERIMENTAL_DEMO` CatBoost artifact once, validates contract v1.1 and the exact 20-feature order, builds strict as-of history for all candidates at one timestamp, and returns only predicted technical minutes plus warnings. It performs no ranking, recommendation, assignment, ETA computation, persistence, or business-data mutation.

Endpoints:

- `GET /health/live`
- `GET /health/ready`
- `GET /api/v1/model-info`
- `POST /api/v1/repair-duration/predict-candidates`

Next phase only: Spring Boot ML integration, prediction persistence, fallback, and ETA integration.
