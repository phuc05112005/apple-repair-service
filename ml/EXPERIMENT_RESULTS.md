# Experiment Results — Repair Technical Duration Regression V1

Verification date: 2026-10-05, Asia/Ho_Chi_Minh.

## Experiment identity

- Problem: regression of active technical repair duration in minutes.
- Sample: completed ticket with one approved item, one technician assignment,
  no transfer and complete status history.
- Dataset: controlled synthetic data only.
- Generator seed: `20261005`.
- Dataset SHA-256:
  `437ef7311511d5ec61c8482550522fcde3946ff7f9b06c4757c3b64b0c886a6c`.
- Rows / columns: 5,000 / 18.
- Model features: 14; target: 1; audit/non-feature columns: 3.

## Dataset profile

- Prediction timestamps: 2025-01-02 08:05 through 2026-09-29 17:36.
- Latest synthetic completion: 2026-09-29 22:16.
- Device types: iPhone 3,231; MacBook 973; iPad 796.
- Service types: REPLACEMENT 3,912; REPAIR 726; WARRANTY 362.
- Controlled domain: 24 catalog services, 12 technicians, 3 branches.
- Target mean / standard deviation: 118.350 / 64.967 minutes.
- Target median / 95th percentile: 103 / 244 minutes.
- Target minimum / maximum: 30 / 600 minutes.
- Duplicate rows: 0.
- Intentional cold-start rows: 22. Only
  `technician_average_duration_before` and
  `technician_historical_efficiency_before` are missing in those rows.

## Split and selection

- Development: earliest 4,250 rows (85%), ending 2026-06-25 09:26.
- Untouched test: latest 750 rows (15%), starting 2026-06-25 09:50.
- EDA uses development data only.
- Hyperparameter tuning and model selection use four-split
  `TimeSeriesSplit` on development data.
- Winner is locked by development CV MAE before test metrics are evaluated.

Best tuned parameters:

- Decision Tree: `max_depth=5`, `min_samples_leaf=30`.
- Random Forest: `n_estimators=120`, `max_depth=14`,
  `min_samples_leaf=8`, `max_features=0.7`.

## Development temporal-CV metrics

| Candidate | MAE | MSE | RMSE | R² |
|---|---:|---:|---:|---:|
| Random Forest | 23.466 | 1,235.787 | 35.154 | 0.703 |
| Decision Tree | 24.417 | 1,332.046 | 36.497 | 0.680 |
| Standard-duration baseline | 24.484 | 1,387.490 | 37.249 | 0.666 |
| Linear Regression | 30.180 | 1,785.596 | 42.256 | 0.570 |
| Mean baseline | 46.550 | 4,162.605 | 64.518 | -0.001 |

Locked winner: **Random Forest**, selected only from development temporal CV.

## Untouched-test metrics

These metrics were calculated after the winner was locked and did not change
the selection.

| Candidate | MAE | MSE | RMSE | R² |
|---|---:|---:|---:|---:|
| Random Forest | 24.755 | 1,253.799 | 35.409 | 0.719 |
| Linear Regression | 25.208 | 1,318.011 | 36.304 | 0.705 |
| Decision Tree | 25.398 | 1,349.853 | 36.740 | 0.697 |
| Standard-duration baseline | 26.669 | 1,539.301 | 39.234 | 0.655 |
| Mean baseline | 47.607 | 4,483.242 | 66.957 | -0.005 |

On this controlled synthetic test set, Random Forest improves MAE over the
existing standard-duration baseline by 1.914 minutes (about 7.2%). This is a
pipeline result, not a production-quality claim.

## Leakage evidence

- Dataset is chronological and test is the latest contiguous block.
- Historical features use a completion-time priority queue; a prior-started but
  unfinished job is not included.
- Unit tests independently reconstruct counts, means, issue experience and
  efficiency as-of each prediction timestamp.
- Encoder, imputer and scaler live inside scikit-learn `Pipeline` objects.
- No preprocessing is fitted on the full dataset before split.
- Test target is first evaluated after the CV winner is locked.
- Identifiers, completion timestamps, feedback, future states, ETA errors and
  hidden synthetic factors are excluded from model input.

## Verification

- Generator completed with exactly 5,000 rows.
- Generator/schema/history/committed-CSV tests: 4 passed.
- Notebook: 36 cells; 18 code cells executed; 0 execution errors.
- Actual-vs-predicted, residual and subgroup error analyses are embedded in the
  executed notebook.
- Cold-start sample with an unseen technician executes successfully through
  `OneHotEncoder(handle_unknown="ignore")` and train-fitted imputation.

## Limitations

- Synthetic data cannot establish real-world accuracy, generalization or
  business value.
- V1 excludes multi-item tickets, technician transfers, incomplete histories
  and plans not known by assignment time.
- The current production duration implementation does not subtract persisted
  `service_interruptions`; the V1 generator does not simulate them.
- Catalog master data lacks a full canonical seed dataset in the repository, so
  the generator uses a documented controlled synthetic catalog compatible with
  the current schema relationships and enums.
- No model artifact is approved or stored because real-data validation has not
  occurred.

No satisfaction classifier, runtime ML API, Spring integration, ETA change,
frontend change or production prediction write is part of this experiment.
