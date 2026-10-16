# Final data contract — repair technical duration

## Prediction problem

The model estimates `actual_technical_minutes`, not ETA. For active status
intervals `[b_k,e_k)` and the single assignment interval `[a_s,a_e)`:

\[
y=\frac{1}{60}\sum_{k:s_k\in\{INSPECTING,REPAIRING\}}
\max\left(0,\min(e_k,a_e)-\max(b_k,a_s)\right)_{seconds}.
\]

Queue time, waiting for approval, waiting for parts, configured break, transfer
gap and waiting for handover are excluded. The current production duration
service does not yet subtract persisted `service_interruptions`; the experiment
documents that limit and does not silently invent corrected targets.

## Sample grain and prediction timestamp

One sample is a completed ticket with exactly one APPROVED `RepairItem`, one
concrete `ServiceCatalogItem`, exactly one ended `Assignment`, no accepted
transfer, complete ordered status history and a positive target. Multi-item and
transferred tickets are excluded because ticket duration cannot be allocated to
an item without an additional timing source.

`prediction_timestamp` is the first assignment time after the approved
single-item plan is known. Every feature must exist at that instant.

## Warranty semantics

- `technical_action`: only `REPAIR` or `REPLACEMENT`.
- `is_warranty`: binary business context.
- Production extraction would derive warranty from
  `repair_items.warranty_source_item_id IS NOT NULL` and normalize the actual
  remedy/catalog action to repair or replacement.
- Legacy service type `WARRANTY` is not a third ML action.
- Synthetic target generation applies no hidden warranty duration multiplier.

## Exact final feature order

1. `device_type`
2. `device_model`
3. `service_issue`
4. `technical_action`
5. `is_warranty`
6. `catalog_service`
7. `standard_duration_minutes`
8. `technician_id`
9. `branch_id`
10. `prediction_month`
11. `prediction_weekday`
12. `technician_jobs_completed_before`
13. `technician_average_duration_before`
14. `technician_historical_efficiency_before`
15. `technician_issue_jobs_before`
16. `technician_issue_average_duration_before`
17. `technician_issue_efficiency_before`
18. `technician_catalog_jobs_before`
19. `technician_catalog_average_duration_before`
20. `technician_catalog_efficiency_before`

The output schema adds `sample_id`, `prediction_timestamp`, `completed_at` and
the target, for 24 columns total.

## Strict history and missing values

For overall, issue and exact-catalog history, a prior job is eligible only when:

`previous_job.completed_at < current_prediction_timestamp`.

An earlier-started but unfinished job is excluded. Cold-start counts are zero;
averages and efficiencies remain missing. Random Forest and XGBoost use median
numeric imputation learned inside each training fold and one-hot encoding with
unknown-category support. CatBoost receives native categorical values and
numeric `NaN`. No statistic is filled from the full dataset.

## Split and feature evidence

The earliest 85% is development data. Its four forward `TimeSeriesSplit` folds
are reused for correlation review, cumulative feature-group ablation, tuning
and model selection. The latest 15% is opened only after winner lock.

The final features require four kinds of evidence: business meaning,
availability at prediction, leakage safety and development predictive
contribution. Numeric Pearson correlation is descriptive only. It neither
automatically selects features nor justifies arbitrary integer encoding of
nominal categories. The fixed XGBoost ablation adds base job, technician
overall, technician×issue and technician×catalog groups cumulatively.

## Synthetic-data boundary

The generator models plausible catalog relationships, technicians, branches,
ordinary noise, rare complexity and outliers. Latent factors are never exported
as features. Synthetic metrics demonstrate the pipeline and cannot establish
real operational accuracy, fairness, drift resistance or production fitness.
