# Repair-duration dataset contract V2

## Scope and sample unit

This contract covers only regression of `actual_technical_minutes`. One row is
one completed service ticket that satisfies every rule below:

1. exactly one `repair_items` row with decision `APPROVED`;
2. the approved catalog plan is known at prediction time;
3. exactly one technician assignment;
4. no accepted transfer and no transfer-origin assignment;
5. complete, continuous `service_status_histories`;
6. a technical completion timestamp is recorded.

This conservative grain follows the current database. Active duration exists
at ticket/status/assignment level; there is no defensible per-item timer for a
multi-item or transferred ticket. Expanding the grain requires new production
measurement semantics, not synthetic allocation.

## Prediction timestamp

The prediction timestamp is the first assignment time after the single
approved repair plan is known. Every feature must be available at or before
this instant. The strict historical rule is:

```text
previous_job.completed_at < current_prediction_timestamp
```

Equality is excluded. A job completing at the same instant is not prior
knowledge. The extractor must process rows chronologically and release pending
jobs into history only after their completion precedes the next prediction.

## Target reconstruction

For active ticket status intervals \([s_k,e_k)\) and the one assignment
interval \([a_s,a_e)\):

$$
y = \texttt{actual\_technical\_minutes}
= \frac{1}{60}\sum_{k:u_k\in\{INSPECTING,REPAIRING\}}
\max\left(0,\min(e_k,a_e)-\max(s_k,a_s)\right)_{seconds}.
$$

Included: `INSPECTING` and `REPAIRING` intersected with the assignment.

Excluded: `ASSIGNED` queue, `WAITING_APPROVAL`, `WAITING_PART`, configured
break, transfer gap, `WAITING_HANDOVER`, appointment/customer waiting and ETA.

`service_interruptions` is persisted, but `RepairDurationService` and
`TimingMetricsService` currently do not subtract it. V2 therefore does not
pretend interruptions are integrated. A future business-rule change must
version the target and rebuild the dataset.

## Exact feature contract

The ordered model input has 14 columns. `sample_id`, `prediction_timestamp`,
`completed_at` and the target are audit columns, not features.

| Feature | Type | Production source/derivation | Available at prediction | Leakage/cold-start rule |
|---|---|---|---|---|
| `device_type` | category | repair item → ticket/customer device → model → device type | yes | use stored master value; unknown category must not crash |
| `device_model` | category | repair item/ticket device model | yes | no serial number or customer identity |
| `service_issue` | category | approved item → catalog → issue | yes | must be the plan known at prediction |
| `service_type` | category | approved item → catalog → service type | yes | `REPAIR`, `REPLACEMENT` or `WARRANTY` |
| `catalog_service` | category | approved catalog item identifier/name snapshot | yes | use stable catalog key in the real extractor; synthetic label is versioned |
| `standard_duration_minutes` | numeric | approved catalog configured duration snapshot | yes | null plans are ineligible; never replace with actual duration |
| `technician_id` | category | the single assignment technician | yes | unseen technician supported; no name/phone |
| `branch_id` | category | ticket branch | yes | unseen branch supported |
| `prediction_month` | category | `M01`…`M12` from prediction timestamp in business timezone | yes | timestamp-derived only |
| `prediction_weekday` | category | `MON`…`SUN` from prediction timestamp | yes | timestamp-derived only |
| `technician_jobs_completed_before` | numeric | count of eligible prior jobs for technician | yes | 0 for new technician; strict as-of |
| `technician_average_duration_before` | numeric | mean target of eligible prior jobs for technician | yes | missing for no history; model preprocessing imputes/native-handles |
| `technician_issue_experience_before` | numeric | count of eligible prior technician jobs with same issue | yes | 0 for no matching history; strict as-of |
| `technician_historical_efficiency_before` | numeric | mean `(actual / standard)` over eligible prior technician jobs | yes | missing for no history; no invented average |

V2 retains the same 14 features as V1. The audit found all are derivable from
the current domain and available at prediction time. Retaining the contract also
allows a future real dataset to use the same training code.

## Exclusions

The extractor and dataset must exclude:

- `actual_technical_minutes` and `completed_at` from model input;
- actual completion/status events after the prediction timestamp;
- feedback, satisfaction labels and free text;
- ETA error, previous prediction output or current/future ETA;
- customer identity, name, phone, ticket code and device serial;
- price/payment outcome;
- hidden synthetic capability, specialty, case-complexity, noise and outlier
  factors;
- history computed by a full-dataset `groupby`, backward fill or any operation
  that sees later completions.

## Missing data and cold start

The only intentional missing values are
`technician_average_duration_before` and
`technician_historical_efficiency_before` when completed-history count is zero.
Counts remain 0. No synthetic history is invented. Model-specific handling is:

- Random Forest and XGBoost: train-fitted numeric median imputation, sparse
  one-hot categories with `handle_unknown="ignore"`;
- HistGradientBoosting: train-fitted median plus dense ordinal categories,
  unknown `-1`, native categorical splits;
- CatBoost: numeric NaN and native categorical features/ordered statistics.

## Synthetic versus real boundary

`synthetic_repair_duration_v2.csv` is controlled synthetic data. The repository
contains table definitions and a narrow migration insert, but no complete
canonical device/model/issue/catalog seed. The V2 generator therefore owns a
versioned synthetic catalog with logical relationships for iPhone, iPad,
MacBook, Apple Watch and AirPods. These labels are not asserted to exist in the
business database.

Latent target factors remain generator-internal. The exported schema contains
only fields that a production extractor can derive. Synthetic data proves the
pipeline and leakage guards run; it cannot validate real operational accuracy.

## Future production extraction

The next phase must read a transactionally consistent MySQL snapshot, enforce
the sample eligibility rules, reconstruct target intervals, sort by prediction
time, and compute histories with the strict completion rule. It should emit a
versioned `real_repair_duration_vX` dataset, run this same competition, evaluate
a later real holdout, and require explicit approval before any runtime use.
