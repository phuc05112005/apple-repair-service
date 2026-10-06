# Experiment Results V2 — Repair Technical Duration Regression

Ngày chạy: `2026-10-05T21:59:39.385980+07:00`. Nhãn artifact:
**EXPERIMENTAL — SYNTHETIC-DATA TRAINED — NOT PRODUCTION VALIDATED**.

## A. Dataset identity

- File: `ml/data/synthetic_repair_duration_v2.csv`
- SHA-256: `3ebff340f1831fb4788fed4642b476d774ae39f104643f64a8d128ef92aa52be`
- Shape: **5,000 rows × 18 columns**
- Prediction range: `2025-01-02T08:05:00` → `2026-09-29T17:36:00`
- Completion max: `2026-09-29T20:08:00`
- Technicians: **12**; branches: **3**
- Duplicated full rows: **0**
- Intentional missing: `{"technician_average_duration_before": 22, "technician_historical_efficiency_before": 22}`

Target minutes: mean **128.752**, median **110.000**,
std **72.117**, P95 **276.000**, min **32**,
max **600**.

### Device distribution

| Device | Rows | Percent |
|---|---|---|
| iPhone | 2455 | 49.100 |
| MacBook | 768 | 15.360 |
| iPad | 753 | 15.060 |
| AirPods | 563 | 11.260 |
| Apple Watch | 461 | 9.220 |

### Service-type distribution

| Service type | Rows | Percent |
|---|---|---|
| REPLACEMENT | 3482 | 69.640 |
| REPAIR | 1101 | 22.020 |
| WARRANTY | 417 | 8.340 |

### Technician distribution

| Technician | Rows | Percent |
|---|---|---|
| TECH_01 | 1054 | 21.080 |
| TECH_02 | 686 | 13.720 |
| TECH_04 | 586 | 11.720 |
| TECH_03 | 505 | 10.100 |
| TECH_05 | 402 | 8.040 |
| TECH_07 | 383 | 7.660 |
| TECH_06 | 324 | 6.480 |
| TECH_08 | 288 | 5.760 |
| TECH_10 | 250 | 5.000 |
| TECH_11 | 212 | 4.240 |
| TECH_09 | 197 | 3.940 |
| TECH_12 | 113 | 2.260 |

### Branch distribution

| Branch | Rows | Percent |
|---|---|---|
| BRANCH_01 | 2253 | 45.060 |
| BRANCH_02 | 1798 | 35.960 |
| BRANCH_03 | 949 | 18.980 |

## B. Experimental contract

Sample là completed ticket có đúng một approved item, một assignment, không
transfer và history đầy đủ. Target là phút `INSPECTING + REPAIRING` giao với
assignment. Persisted `service_interruptions` chưa được production duration
service tự trừ. Có đúng 14 feature theo `DATA_CONTRACT.md`; history tuân thủ
`previous_job.completed_at < current_prediction_timestamp`.

## C. Temporal split and CV

- `earliest 85% development; latest 15% untouched holdout`
- Development: **4250** rows,
  `2025-01-02T08:05:00` → `2026-06-25T09:26:00`
- Holdout: **750** rows,
  `2026-06-25T09:50:00` → `2026-09-29T17:36:00`
- CV: `TimeSeriesSplit(n_splits=4) on development only`; identical folds for all models.
- Primary scoring: MAE. Holdout was excluded from selection and tuning.

Fold configuration:

| Fold | Train rows | Validation rows | Train end | Validation start | Validation end |
|---|---|---|---|---|---|
| 1 | 850 | 850 | 2025-04-18T11:23:00 | 2025-04-18T12:43:00 | 2025-08-07T12:42:00 |
| 2 | 1700 | 850 | 2025-08-07T12:42:00 | 2025-08-07T13:40:00 | 2025-11-26T08:11:00 |
| 3 | 2550 | 850 | 2025-11-26T08:11:00 | 2025-11-26T08:55:00 | 2026-03-17T12:41:00 |
| 4 | 3400 | 850 | 2026-03-17T12:41:00 | 2026-03-17T12:42:00 | 2026-06-25T09:26:00 |

## D. Hyperparameter tuning

Each candidate used eight fixed-seed `RandomizedSearchCV` configurations. The
four candidates received the same folds, metric, dataset and comparable search
effort; preprocessing remained model-appropriate.

Preprocessing:

| Model | Preprocessing |
|---|---|
| RandomForestRegressor | Median imputation for numeric features and sparse one-hot encoding with unknown-category support. |
| HistGradientBoostingRegressor | Dense ordinal categories with explicit unknown=-1 and sklearn native categorical splits; no sparse matrix. |
| XGBRegressor | Median imputation plus sparse one-hot encoding; XGBoost histogram trees consume the sparse matrix. |
| CatBoostRegressor | Native CatBoost categorical handling and ordered target statistics; numeric missing values remain native NaN. |

### RandomForestRegressor

Best parameters:

```json
{
  "model__n_estimators": 320,
  "model__min_samples_leaf": 6,
  "model__max_features": 0.7,
  "model__max_depth": 14
}
```

Search space:

```json
{
  "model__n_estimators": [
    180,
    320
  ],
  "model__max_depth": [
    null,
    14
  ],
  "model__min_samples_leaf": [
    2,
    6
  ],
  "model__max_features": [
    0.7,
    1.0
  ]
}
```

### HistGradientBoostingRegressor

Best parameters:

```json
{
  "model__min_samples_leaf": 30,
  "model__max_leaf_nodes": 31,
  "model__max_iter": 160,
  "model__learning_rate": 0.04,
  "model__l2_regularization": 1.0
}
```

Search space:

```json
{
  "model__max_iter": [
    160,
    260
  ],
  "model__learning_rate": [
    0.04,
    0.08
  ],
  "model__max_leaf_nodes": [
    15,
    31
  ],
  "model__min_samples_leaf": [
    15,
    30
  ],
  "model__l2_regularization": [
    0.0,
    1.0
  ]
}
```

### XGBRegressor

Best parameters:

```json
{
  "model__subsample": 0.8,
  "model__reg_lambda": 1.0,
  "model__reg_alpha": 0.2,
  "model__n_estimators": 200,
  "model__min_child_weight": 5,
  "model__max_depth": 4,
  "model__learning_rate": 0.035,
  "model__colsample_bytree": 0.8
}
```

Search space:

```json
{
  "model__n_estimators": [
    200,
    360
  ],
  "model__learning_rate": [
    0.035,
    0.07
  ],
  "model__max_depth": [
    4,
    7
  ],
  "model__min_child_weight": [
    1,
    5
  ],
  "model__subsample": [
    0.8,
    1.0
  ],
  "model__colsample_bytree": [
    0.8,
    1.0
  ],
  "model__reg_alpha": [
    0.0,
    0.2
  ],
  "model__reg_lambda": [
    1.0,
    5.0
  ]
}
```

### CatBoostRegressor

Best parameters:

```json
{
  "random_strength": 1.0,
  "learning_rate": 0.035,
  "l2_leaf_reg": 8.0,
  "iterations": 240,
  "depth": 5
}
```

Search space:

```json
{
  "iterations": [
    240,
    400
  ],
  "learning_rate": [
    0.035,
    0.07
  ],
  "depth": [
    5,
    7
  ],
  "l2_leaf_reg": [
    3.0,
    8.0
  ],
  "random_strength": [
    0.5,
    1.0
  ]
}
```

## E. Development temporal-CV comparison

| Model | CV MAE mean | CV MAE std | CV MSE | CV RMSE | CV R² | CV P90AE |
|---|---|---|---|---|---|---|
| CatBoostRegressor | 27.167 | 1.107 | 1689.881 | 40.993 | 0.675 | 58.643 |
| XGBRegressor | 27.220 | 1.281 | 1678.521 | 40.843 | 0.678 | 56.937 |
| HistGradientBoostingRegressor | 27.236 | 1.163 | 1650.759 | 40.493 | 0.683 | 57.651 |
| RandomForestRegressor | 28.174 | 1.551 | 1677.480 | 40.841 | 0.678 | 59.492 |
| StandardDurationBaseline | 30.600 | 1.859 | 2224.841 | 46.993 | 0.574 | 67.325 |
| MeanBaseline | 52.744 | 1.573 | 5203.177 | 72.049 | -0.005 | 94.743 |

CV MAE of locked winner: **27.167 ± 1.107 minutes**.

## F. Locked winner and selection reason

**Winner: CatBoostRegressor**

Models within 0.25 minute of the best CV MAE were treated as a practical tie (CatBoostRegressor, XGBRegressor, HistGradientBoostingRegressor). CatBoostRegressor was locked using, in order, lower CV-MAE standard deviation, CV RMSE, CV P90 absolute error and implementation-complexity rank. The test set was not consulted.

The policy was declared before opening holdout: lowest development temporal-CV
MAE; candidates within 0.25 minute use CV stability, RMSE, P90AE and complexity.

## G. Untouched-test comparison

| Model | Test MAE | Test MSE | Test RMSE | Test R² | Test P90AE | Fit seconds | Predict seconds |
|---|---|---|---|---|---|---|---|
| HistGradientBoostingRegressor | 26.992 | 1796.148 | 42.381 | 0.658 | 55.923 | 2.443 | 0.039 |
| CatBoostRegressor | 27.009 | 1800.907 | 42.437 | 0.657 | 56.075 | 12.876 | 0.009 |
| XGBRegressor | 27.017 | 1809.833 | 42.542 | 0.655 | 55.932 | 0.397 | 0.018 |
| RandomForestRegressor | 27.745 | 1715.280 | 41.416 | 0.673 | 58.622 | 17.323 | 0.069 |
| StandardDurationBaseline | 31.215 | 2516.527 | 50.165 | 0.520 | 73.100 | 0.000 | 0.000 |
| MeanBaseline | 52.034 | 5258.109 | 72.513 | -0.002 | 93.324 | 0.000 | 0.000 |

Winner versus standard-duration baseline:

- absolute MAE improvement: **4.205 minutes**;
- relative MAE improvement: **13.472%**;
- winner test P90 absolute error: **56.075 minutes**.

These are synthetic holdout metrics, not production accuracy.

## H. Residual and error diagnostics

The executable run saved `diagnostics.png` with actual-vs-predicted, residual
versus predicted, residual distribution and absolute-error/P90 panels. Signed
residual is `actual - prediction`; positive means underprediction. Raw holdout
rows and errors are in `test_predictions.csv`.

Residual summary: mean **8.898**, median **1.852**,
standard deviation **41.521**, min **-103.299**, max
**332.242** minutes.

## I. Subgroup errors

Every row includes sample count; groups with small N must not be overinterpreted.

### `technician_id`

| Group | N | MAE | RMSE |
|---|---|---|---|
| TECH_09 | 45 | 35.743 | 58.289 |
| TECH_07 | 83 | 34.074 | 50.675 |
| TECH_02 | 61 | 31.358 | 43.288 |
| TECH_06 | 52 | 30.991 | 56.296 |
| TECH_04 | 70 | 30.244 | 45.563 |
| TECH_12 | 45 | 27.527 | 49.710 |
| TECH_01 | 71 | 26.597 | 36.869 |
| TECH_05 | 71 | 24.913 | 35.438 |
| TECH_03 | 61 | 24.137 | 34.797 |
| TECH_08 | 62 | 21.426 | 28.358 |
| TECH_10 | 66 | 21.412 | 40.377 |
| TECH_11 | 63 | 16.970 | 22.543 |
### `device_type`

| Group | N | MAE | RMSE |
|---|---|---|---|
| MacBook | 106 | 38.983 | 54.635 |
| iPad | 114 | 33.730 | 44.407 |
| iPhone | 360 | 23.688 | 40.778 |
| AirPods | 98 | 23.490 | 38.386 |
| Apple Watch | 72 | 20.138 | 30.379 |
### `service_issue`

| Group | N | MAE | RMSE |
|---|---|---|---|
| Mainboard | 35 | 64.937 | 97.957 |
| Bàn phím | 30 | 51.300 | 70.850 |
| Chống ồn | 17 | 34.639 | 62.615 |
| Sạc không dây | 13 | 30.913 | 37.516 |
| Cổng sạc | 69 | 28.977 | 43.764 |
| Màn hình | 185 | 28.553 | 39.250 |
| Digital Crown | 15 | 23.316 | 44.733 |
| Âm thanh | 24 | 23.055 | 28.581 |
| Camera | 24 | 21.843 | 26.224 |
| Pin | 288 | 20.246 | 30.116 |
| Hộp sạc | 25 | 19.158 | 29.066 |
| Pin tai nghe | 25 | 17.425 | 23.390 |
### `service_type`

| Group | N | MAE | RMSE |
|---|---|---|---|
| REPAIR | 179 | 35.726 | 59.732 |
| WARRANTY | 73 | 26.589 | 34.477 |
| REPLACEMENT | 498 | 23.938 | 35.433 |

## J. Cold start

```json
{
  "known_history": 122.36665647964242,
  "new_technician": 111.80170297379907,
  "unseen_categories": 113.42977602781342
}
```

Known history, a new technician with counts 0/history missing, and unseen
categories all produced finite predictions without inventing prior jobs.

## K. Feature importance

Permutation importance is the increase in holdout MAE after shuffling one
original feature. Importance is predictive association, **not causality**.

| Feature | Mean MAE increase | Std |
|---|---|---|
| standard_duration_minutes | 23.818 | 0.723 |
| service_type | 2.022 | 0.340 |
| technician_historical_efficiency_before | 0.946 | 0.155 |
| device_type | 0.780 | 0.128 |
| technician_id | 0.471 | 0.100 |
| service_issue | 0.441 | 0.109 |
| catalog_service | 0.334 | 0.128 |
| technician_average_duration_before | 0.119 | 0.049 |
| device_model | 0.113 | 0.062 |
| technician_jobs_completed_before | 0.039 | 0.014 |
| prediction_month | -0.002 | 0.022 |
| technician_issue_experience_before | -0.004 | 0.028 |
| prediction_weekday | -0.012 | 0.008 |
| branch_id | -0.027 | 0.033 |

## L. Runtime and artifact

- Winner model file: `model.cbm`
- Format: CatBoost native CBM; consumes a pandas frame matching feature_contract.json
- Artifact size: **396,836 bytes**
- Winner full-development fit: **12.876 s**
- Winner holdout prediction: **0.009 s** for 750 rows
- Environment: Python 3.13.6, sklearn 1.8.0, XGBoost 3.2.0, CatBoost 1.2.8.

## M. Limitations and status

- Controlled synthetic data cannot validate real operational accuracy or drift.
- Multi-item tickets, transfers and incomplete histories are excluded.
- Catalog labels are a versioned synthetic domain, not claimed live master data.
- Interruption persistence is not yet subtracted by production duration logic.
- No satisfaction classifier, Spring/FastAPI integration, ETA change,
  auto-assignment or production extractor was added.

The saved winner remains **EXPERIMENTAL, SYNTHETIC-DATA TRAINED, NOT PRODUCTION
VALIDATED**. The next phase is real MySQL snapshot → leakage-safe extractor →
same feature contract and training pipeline → real temporal validation → model
approval before runtime integration.
