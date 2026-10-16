# Runtime Inference Contract

## Ownership

The internal Python service owns read-only ML feature construction, strict historical aggregates, CatBoost loading, and technical-duration inference. Spring Boot remains the future owner of authorization, valid-candidate selection, schedules, workload, queue, breaks, assignment, fallback, ETA, and `ml_predictions` persistence.

## Model

Artifact: `models/experimental/model.cbm`. Status remains `EXPERIMENTAL_DEMO`, `syntheticData=true`, `productionValidated=false`. The process loads it once and validates metadata, contract v1.1, target, categorical/numeric declarations, exact 20-feature order, and compatible CatBoost major/minor version.

## Input and time

`POST /api/v1/repair-duration/predict-candidates` accepts `ticketId`, 1–50 unique positive `candidateTechnicianIds`, and timezone-aware `evaluationTimestamp`. Runtime interprets this as a hypothetical immediate assignment time and normalizes it to `Asia/Ho_Chi_Minh`. Every candidate uses the same instant. Training used the actual `assignments.assigned_at`, so both represent information known at assignment.

Only completed eligible jobs with `completed_at < evaluationTimestamp` enter overall, issue, or exact-catalog history. Equality and future completion are excluded. Cold start is count 0 with missing averages and efficiencies.

## Catalog and warranty

The model feature is the minimally trimmed `service_catalog_items.name`. Internal catalog ID alone groups exact history. Unseen training labels are accepted with `UNSEEN_CATALOG_CATEGORY`. Warranty resolves only to `REPAIR` or `REPLACEMENT` plus `is_warranty=1`; `WARRANTY` is never a technical action.

## Output

Each ordered candidate result contains `technicianId`, a finite positive floating-point `predictedTechnicalMinutes`, and warnings. The response has model name/version/status/contract and experimental flags. It has no raw feature vector, ETA, queue, rank, recommendation, fallback, or assignment decision.

## HTTP and failures

- `GET /health/live`: process health only.
- `GET /health/ready`: loaded/validated model plus DB connectivity.
- `GET /api/v1/model-info`: non-sensitive artifact and runtime version data.
- `POST /api/v1/repair-duration/predict-candidates`: batch inference.

Errors use a stable code and safe message with 400/404/409/422/500/503 status as appropriate. Unexpected errors do not expose tracebacks or dependency details. DB connections use timeouts and read-only transactions. The service selects no customer PII, enables no public CORS, performs no writes, and is intended only for internal deployment.

## Limitations

The model is synthetic-trained and has no real statistical validation. Runtime V1 supports exactly one approved item and does not aggregate multi-item predictions. Canonical DB currently has no historical tickets, so candidates are cold start. Python intentionally provides no fallback; the future Spring phase will own failure policy and business integration.
