# Data Contract — Repair Technical Duration Regression V1

## 1. Prediction question and as-of time

For a technician assignment whose single approved catalog plan is already
known, predict the active technical minutes required by that repair job.

The V1 prediction timestamp is `assignments.assigned_at`. A future production
extractor must include only a repair item that existed and was stable by that
timestamp. Because V1 has no versioned repair-plan history, a conservative
historical extraction should require both `repair_items.created_at` and
`repair_items.updated_at` to be no later than `assigned_at`.

The model output is a duration. It is not ETA. The existing operational layer
remains responsible for combining duration with queue, working schedule, break
and state.

## 2. Sample unit and inclusion criteria

One V1 sample is one completed `service_tickets` row satisfying all conditions:

1. `actual_repair_completed_at` is present and status is `WAITING_HANDOVER` or
   `HANDED_OVER`.
2. Status history is non-empty, chronological and continuous.
3. Exactly one `repair_items` row is selected for execution with
   `approval_status = APPROVED`.
4. That item has one concrete `service_catalog_items` relation and was known at
   prediction time.
5. Exactly one `assignments` row exists; `ended_at` is present.
6. No accepted `transfers` row exists and assignment source is not `TRANSFER`.
7. Active technical duration is positive.

Tickets with several items, several assignments, transfers, incomplete history
or a plan established after assignment are excluded from V1. They are not
silently relabelled.

## 3. Target reconstruction

`actual_technical_minutes` is reconstructed from production data as follows:

```text
active_status_intervals = every interval entered through a
                          service_status_histories.to_status of
                          INSPECTING or REPAIRING

assignment_interval = [assignments.assigned_at, assignments.ended_at]

actual_technical_minutes = floor(sum(
    intersection(active_status_interval, assignment_interval)
) in seconds / 60)
```

This matches the active-state semantics in `RepairDurationService` and the
technician attribution logic in `TimingMetricsService`. It excludes:

- `ASSIGNED` queue time;
- `WAITING_APPROVAL` and `WAITING_PART`;
- technician scheduling break;
- transfer gaps;
- `WAITING_HANDOVER` and customer handover wait;
- appointment wait.

`service_interruptions` has persistence and schema validation, but the current
duration services do not query or subtract it. Therefore V1 does not claim that
interruptions are automatically removed. The synthetic generator does not
simulate interruptions. A later phase may introduce tested interval subtraction
and version the label contract.

## 4. Model feature contract

All categorical labels in the synthetic CSV are controlled aliases. A real
extractor may use stable IDs or canonical names, but training and inference must
use the same representation.

| ML column | Type | Business meaning | Production source / derivation | Available at prediction | Model feature | Leakage risk and handling |
|---|---|---|---|---|---|---|
| `device_type` | categorical | Device family | `service_tickets.customer_device_id` → `customer_devices.device_model_id` → `device_models.device_type_id` → `device_types.name` | yes | yes | Use value as-of assignment; master rename requires contract versioning |
| `device_model` | categorical | Exact device model | `customer_devices.device_model_id` → `device_models.name` | yes | yes | Same as above |
| `service_issue` | categorical | Technical issue of the selected plan | Single item → `service_catalog_items.service_issue_id` → `service_issues.name` | yes, under V1 restriction | yes | Exclude plans created/changed after prediction |
| `service_type` | categorical | `REPAIR`, `REPLACEMENT` or `WARRANTY` | Single item → catalog → `service_types.code` | yes | yes | Do not infer from final outcome |
| `catalog_service` | categorical | Configured technical plan | `repair_items.service_catalog_item_id` → `service_catalog_items.name` | yes, under V1 restriction | yes | `handle_unknown=ignore` for a new catalog value |
| `standard_duration_minutes` | numeric | Current business estimate for the selected plan | `service_catalog_items.standard_duration_minutes` | yes | yes | Snapshot/as-of semantics are needed if catalog duration later changes |
| `technician_id` | categorical | Assigned technician identity | The single `assignments.technician_id`; synthetic labels use `TECH_nn` | yes | yes | Cold-start category is allowed; identity is used intentionally, not as row ID |
| `branch_id` | categorical | Processing branch | `service_tickets.branch_id`; synthetic labels use `BRANCH_nn` | yes | yes | Operational differences may exist; no address or customer data used |
| `prediction_month` | categorical | Calendar month at assignment | Month derived from `assignments.assigned_at` in business timezone | yes | yes | Derive from prediction time, never completion time |
| `prediction_weekday` | categorical | Weekday at assignment | Weekday derived from `assignments.assigned_at` | yes | yes | Same rule |
| `technician_jobs_completed_before` | numeric | Prior eligible jobs completed by technician | Count V1-eligible samples for technician where technical completion `< current assigned_at` | yes | yes | Strict as-of aggregation; never whole-dataset groupby |
| `technician_average_duration_before` | numeric nullable | Mean target of prior eligible jobs | Expanding mean of prior completed eligible jobs only | yes | yes | Missing for cold-start; median imputer is fit in each train fold |
| `technician_issue_experience_before` | numeric | Prior eligible jobs for same technician and issue | Expanding technician+issue count with completion `< current assigned_at` | yes | yes | Strict as-of aggregation |
| `technician_historical_efficiency_before` | numeric nullable | Prior mean `actual / standard` ratio | Expanding ratio mean over prior completed eligible jobs only | yes | yes | Missing for cold-start; never uses current/future target |

The V1 model has 14 features: nine categorical and five numeric.

## 5. Non-feature and excluded-column contract

| Column/data | Role | Use as feature | Reason |
|---|---|---|---|
| `sample_id` | Synthetic row identifier | no | Identifier has no causal business meaning |
| `prediction_timestamp` | Sort/split/as-of audit | no | Used for chronology, not prediction |
| `completed_at` | Historical eligibility and audit | no | Future information at prediction time |
| `actual_technical_minutes` | Regression target | no | Direct target leakage |
| `service_tickets.actual_repair_completed_at` | Target cutoff | no | Future timestamp |
| `service_tickets.handed_over_at` | Handover reporting | no | Future and includes customer waiting |
| Current/future ticket status | Workflow outcome | no | Future-state leakage |
| `service_feedbacks.satisfied/comment` | Service-quality reporting | no | Created after service; classification was explicitly removed |
| `ml_predictions` values | Runtime prediction history | no | Model output/circular feature; this phase never writes it |
| Queue/wait/break duration | ETA operations | no | Outside technical-duration target and generally future at assignment |
| Ticket code, customer, phone, serial, free text | Identity/PII | no | Unnecessary, unsafe and non-generalizable |
| Hidden synthetic speed, complexity and outlier factors | Generator only | no | They are unavailable in production and would reveal the target process |

## 6. Temporal leakage prevention

For sample `s` with prediction timestamp `t_s`, historical technician features
may use a prior job `j` only when:

```text
j.actual_repair_completed_at < t_s
```

Sorting by prediction time alone is insufficient because an earlier-started job
may still be in progress. The generator maintains a completion-time priority
queue and updates history only when a job leaves that queue before the current
prediction timestamp. Unit tests independently reconstruct the same as-of state.

Cold-start rules:

- counts start at zero;
- average duration and historical efficiency remain missing until at least one
  eligible job is completed;
- missing values are handled inside the model pipeline;
- no synthetic history is invented for a new technician;
- unseen technician categories are accepted by `OneHotEncoder` and fall back to
  the other observed context plus learned numeric imputation.

## 7. How this synthetic dataset maps to production data

| Synthetic concept | Production mapping | Required extraction behavior |
|---|---|---|
| One CSV row | One restricted completed service ticket | Apply every inclusion criterion before building features |
| Synthetic catalog tuple | Device/model/issue/type/catalog joins | Read current canonical relations; do not invent a disconnected taxonomy |
| `prediction_timestamp` | Single assignment's `assigned_at` | Enforce business timezone and plan-known rule |
| `completed_at` | `actual_repair_completed_at` / assignment end | Used only for labels and historical eligibility |
| `actual_technical_minutes` | Active history intervals ∩ assignment | Validate status continuity; exclude wait states |
| Technician history | Earlier eligible completed tickets | Compute in chronological order or with equivalent as-of SQL/window logic |
| Missing cold-start history | Technician has no prior eligible completion | Preserve missing; let train-fold preprocessing handle it |

The production extractor should output this same model-feature contract before
runtime integration is considered. It must version master-data snapshots or
apply conservative as-of restrictions where the current schema lacks history.

## 8. Synthetic generating process

The canonical schema contains the required tables, constraints and enums but no
complete master-data seed for all device/model/issue/catalog relationships.
Therefore V1 uses a controlled synthetic domain rather than reading the user
database or pretending the migration's limited warranty rows are a full seed.

The committed V1 generator uses seed `20261005`, 24 controlled catalog
combinations compatible with current entity relationships, 12 synthetic
technicians and three synthetic branches. It spans business days from January
2025 through September 2026.

The target depends on hidden technician speed, technician/issue specialty,
branch and service-type effects, mild seasonality, log-normal case noise,
occasional complex cases and a small technical-outlier fraction. Only observable
contract columns are exported. Non-technical elapsed minutes affect
`completed_at` so history is realistic, but they never enter the target.

This process is deliberately noisy. High synthetic scores demonstrate that the
pipeline can recover a controlled signal; they are not evidence of real-world
accuracy.
