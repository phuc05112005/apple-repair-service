# Experiment Results V3 — Repair Technical Duration Regression

Run time: 2026-10-06T09:45:55.234273+07:00. Artifact label:
**EXPERIMENTAL — SYNTHETIC-DATA TRAINED — NOT PRODUCTION VALIDATED**.

## A. Files and experiment identity

- Dataset: ml/data/synthetic_repair_duration_v3.csv
- Artifact: ml/models/experimental_v3/
- Experiment version: V3
- Seed: 20261006
- SHA-256: 59984f5c860972e16d3f7503613a9dbe6946252b1cad8f2ae932e364a01a384d
- Shape: 5,000 rows × 24 columns
- Prediction range: 2025-01-02T08:17:00 → 2026-09-30T17:45:00
- Completion max: 2026-09-30T23:37:00
- Duplicates: 0
- Missing: {'technician_average_duration_before': 17, 'technician_historical_efficiency_before': 17, 'technician_issue_average_duration_before': 152, 'technician_issue_efficiency_before': 152, 'technician_catalog_average_duration_before': 449, 'technician_catalog_efficiency_before': 449}

Target mean 141.392, std 82.538, median
121.000, P95 311.000, min 27,
max 600 minutes.

### device_type

| device_type | rows | percent |
| ----------- | ---- | ------- |
| iPhone      | 2433 | 48.660  |
| MacBook     | 787  | 15.740  |
| iPad        | 747  | 14.940  |
| AirPods     | 596  | 11.920  |
| Apple Watch | 437  | 8.740   |
### technical_action

| technical_action | rows | percent |
| ---------------- | ---- | ------- |
| REPLACEMENT      | 3645 | 72.900  |
| REPAIR           | 1355 | 27.100  |
### is_warranty

| is_warranty | rows | percent |
| ----------- | ---- | ------- |
| 0           | 4433 | 88.660  |
| 1           | 567  | 11.340  |
### technician_id

| technician_id | rows | percent |
| ------------- | ---- | ------- |
| TECH_01       | 1028 | 20.560  |
| TECH_02       | 692  | 13.840  |
| TECH_04       | 541  | 10.820  |
| TECH_03       | 528  | 10.560  |
| TECH_05       | 471  | 9.420   |
| TECH_07       | 374  | 7.480   |
| TECH_06       | 316  | 6.320   |
| TECH_08       | 267  | 5.340   |
| TECH_10       | 238  | 4.760   |
| TECH_09       | 232  | 4.640   |
| TECH_11       | 186  | 3.720   |
| TECH_12       | 127  | 2.540   |

## B. Warranty semantic

V3 replaces V2 service_type including WARRANTY with technical_action limited to
REPAIR/REPLACEMENT plus binary is_warranty. Warranty has no hidden technical
duration multiplier. Production mapping is documented in DATA_CONTRACT.md.

## C. Exact feature list

[
  "device_type",
  "device_model",
  "service_issue",
  "technical_action",
  "is_warranty",
  "catalog_service",
  "standard_duration_minutes",
  "technician_id",
  "branch_id",
  "prediction_month",
  "prediction_weekday",
  "technician_jobs_completed_before",
  "technician_average_duration_before",
  "technician_historical_efficiency_before",
  "technician_issue_jobs_before",
  "technician_issue_average_duration_before",
  "technician_issue_efficiency_before",
  "technician_catalog_jobs_before",
  "technician_catalog_average_duration_before",
  "technician_catalog_efficiency_before"
]

## D. Temporal split and folds

- Policy: earliest 85% development; latest 15% untouched holdout
- Development: 4250 rows,
  2025-01-02T08:17:00 → 2026-06-29T09:10:00
- Holdout: 750 rows,
  2026-06-29T09:24:00 → 2026-09-30T17:45:00
- CV: TimeSeriesSplit(n_splits=4) on development only

| fold | train_rows | validation_rows | train_end           | validation_start    | validation_end      |
| ---- | ---------- | --------------- | ------------------- | ------------------- | ------------------- |
| 1    | 850        | 850             | 2025-04-18T16:17:00 | 2025-04-21T08:15:00 | 2025-07-30T16:42:00 |
| 2    | 1700       | 850             | 2025-07-30T16:42:00 | 2025-07-31T08:46:00 | 2025-11-18T12:51:00 |
| 3    | 2550       | 850             | 2025-11-18T12:51:00 | 2025-11-18T13:44:00 | 2026-03-13T08:50:00 |
| 4    | 3400       | 850             | 2026-03-13T08:50:00 | 2026-03-13T09:22:00 | 2026-06-29T09:10:00 |

## E. Model preprocessing

| model                         | preprocessing                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| RandomForestRegressor         | Median numeric imputation and sparse one-hot categories with unknown-category support.                             |
| HistGradientBoostingRegressor | Median numeric imputation, dense ordinal encoding with unknown=-1, and sklearn native categorical splits.          |
| XGBRegressor                  | Median numeric imputation and sparse one-hot categories; histogram trees use reg:squarederror with MAE evaluation. |
| CatBoostRegressor             | Native CatBoost categoricals and ordered statistics; numeric NaN values remain native missing values.              |

## F. Search effort and best parameters

Twelve fixed-seed randomized configurations were evaluated for each candidate
on the same four temporal folds, with neg_mean_absolute_error.

### RandomForestRegressor

Best parameters:

~~~json
{
  "model__n_estimators": 160,
  "model__min_samples_split": 2,
  "model__min_samples_leaf": 10,
  "model__max_features": 0.6,
  "model__max_depth": null
}
~~~

Search space:

~~~json
{
  "model__n_estimators": [
    160,
    240,
    320
  ],
  "model__max_depth": [
    null,
    12,
    18
  ],
  "model__min_samples_split": [
    2,
    6,
    12
  ],
  "model__min_samples_leaf": [
    2,
    5,
    10
  ],
  "model__max_features": [
    0.6,
    0.8,
    1.0
  ]
}
~~~
### HistGradientBoostingRegressor

Best parameters:

~~~json
{
  "model__min_samples_leaf": 25,
  "model__max_leaf_nodes": 15,
  "model__max_iter": 200,
  "model__max_depth": 7,
  "model__learning_rate": 0.035,
  "model__l2_regularization": 4.0
}
~~~

Search space:

~~~json
{
  "model__max_iter": [
    130,
    200,
    280
  ],
  "model__learning_rate": [
    0.035,
    0.06,
    0.09
  ],
  "model__max_leaf_nodes": [
    15,
    31,
    63
  ],
  "model__max_depth": [
    null,
    7,
    11
  ],
  "model__min_samples_leaf": [
    15,
    25,
    40
  ],
  "model__l2_regularization": [
    0.0,
    1.0,
    4.0
  ]
}
~~~
### XGBRegressor

Best parameters:

~~~json
{
  "model__subsample": 1.0,
  "model__reg_lambda": 8.0,
  "model__reg_alpha": 0.0,
  "model__n_estimators": 160,
  "model__min_child_weight": 1,
  "model__max_depth": 3,
  "model__learning_rate": 0.05,
  "model__colsample_bytree": 0.75
}
~~~

Search space:

~~~json
{
  "model__n_estimators": [
    160,
    240,
    340
  ],
  "model__learning_rate": [
    0.025,
    0.05,
    0.08
  ],
  "model__max_depth": [
    3,
    5,
    7
  ],
  "model__min_child_weight": [
    1,
    4,
    8
  ],
  "model__subsample": [
    0.75,
    0.9,
    1.0
  ],
  "model__colsample_bytree": [
    0.75,
    0.9,
    1.0
  ],
  "model__reg_alpha": [
    0.0,
    0.2,
    0.8
  ],
  "model__reg_lambda": [
    1.0,
    4.0,
    8.0
  ]
}
~~~
### CatBoostRegressor

Best parameters:

~~~json
{
  "random_strength": 1.0,
  "learning_rate": 0.05,
  "l2_leaf_reg": 7.0,
  "iterations": 160,
  "depth": 6
}
~~~

Search space:

~~~json
{
  "iterations": [
    160,
    240,
    320
  ],
  "learning_rate": [
    0.025,
    0.05,
    0.08
  ],
  "depth": [
    5,
    6,
    8
  ],
  "l2_leaf_reg": [
    3.0,
    7.0,
    12.0
  ],
  "random_strength": [
    0.4,
    1.0,
    1.8
  ]
}
~~~

## G. Development temporal-CV comparison

| model                         | cv_mae_mean | cv_mae_std | cv_mse   | cv_rmse | cv_r2  | cv_p90_absolute_error | cv_within_15_percent | cv_within_30_percent | cv_within_45_percent |
| ----------------------------- | ----------- | ---------- | -------- | ------- | ------ | --------------------- | -------------------- | -------------------- | -------------------- |
| HistGradientBoostingRegressor | 31.081      | 3.310      | 2300.051 | 47.727  | 0.668  | 64.611                | 38.618               | 64.794               | 79.618               |
| CatBoostRegressor             | 31.192      | 2.522      | 2130.387 | 46.016  | 0.692  | 64.690                | 35.882               | 63.176               | 79.412               |
| XGBRegressor                  | 31.227      | 1.977      | 2161.967 | 46.381  | 0.687  | 65.773                | 36.176               | 63.294               | 79.176               |
| RandomForestRegressor         | 31.264      | 2.045      | 2153.154 | 46.302  | 0.688  | 65.712                | 36.735               | 62.941               | 79.294               |
| StandardDurationBaseline      | 37.249      | 3.753      | 3499.446 | 58.978  | 0.495  | 85.050                | 37.471               | 60.765               | 75.000               |
| MeanBaseline                  | 61.037      | 1.135      | 6954.230 | 83.356  | -0.009 | 110.714               | 15.294               | 30.529               | 45.176               |

## H. Locked winner

**XGBRegressor**

Models within 0.25 minute of the best CV MAE were treated as a practical tie (HistGradientBoostingRegressor, CatBoostRegressor, XGBRegressor, RandomForestRegressor). XGBRegressor was locked using, in order, lower CV-MAE standard deviation, CV RMSE, CV P90 absolute error and implementation-complexity rank. The test set was not consulted.

## I. Untouched V3 holdout

| model                         | mae    | mse      | rmse   | r2     | p90_absolute_error | within_15_percent | within_30_percent | within_45_percent | fit_seconds | predict_seconds |
| ----------------------------- | ------ | -------- | ------ | ------ | ------------------ | ----------------- | ----------------- | ----------------- | ----------- | --------------- |
| HistGradientBoostingRegressor | 27.928 | 1730.849 | 41.603 | 0.739  | 56.805             | 38.267            | 67.200            | 81.867            | 0.701       | 0.042           |
| CatBoostRegressor             | 29.021 | 1802.129 | 42.451 | 0.728  | 60.860             | 37.733            | 67.067            | 81.733            | 7.116       | 0.007           |
| RandomForestRegressor         | 29.274 | 1793.112 | 42.345 | 0.729  | 60.059             | 36.133            | 64.267            | 81.200            | 7.340       | 0.039           |
| XGBRegressor                  | 29.457 | 1834.091 | 42.826 | 0.723  | 61.014             | 34.933            | 64.933            | 81.200            | 0.151       | 0.013           |
| StandardDurationBaseline      | 34.788 | 2933.591 | 54.163 | 0.557  | 79.000             | 38.933            | 62.267            | 75.467            | 0.000       | 0.000           |
| MeanBaseline                  | 60.152 | 6646.059 | 81.523 | -0.004 | 105.124            | 13.733            | 30.267            | 45.467            | 0.000       | 0.000           |

Winner tolerance: ±15 = 34.933%,
±30 = 64.933%,
±45 = 81.200%.

Versus StandardDurationBaseline: MAE improves by
5.331 minutes
(15.324%).

## J. Residual summary

Residual is actual minus prediction. Mean -3.964, median
-8.086, std 42.671, min -143.173,
max 288.756. diagnostics.png contains actual/predicted, residual,
absolute-error and P90 panels.

## K. Feature importance

Permutation importance is predictive association, not causality.

| feature                                    | importance_mean_mae_increase | importance_std |
| ------------------------------------------ | ---------------------------- | -------------- |
| standard_duration_minutes                  | 29.143                       | 1.085          |
| technician_issue_average_duration_before   | 1.390                        | 0.143          |
| technician_catalog_average_duration_before | 1.070                        | 0.096          |
| service_issue                              | 0.804                        | 0.078          |
| branch_id                                  | 0.393                        | 0.094          |
| technician_issue_efficiency_before         | 0.383                        | 0.066          |
| technician_historical_efficiency_before    | 0.366                        | 0.142          |
| device_type                                | 0.168                        | 0.055          |
| technician_issue_jobs_before               | 0.135                        | 0.102          |
| technician_catalog_efficiency_before       | 0.126                        | 0.099          |
| catalog_service                            | 0.089                        | 0.082          |
| device_model                               | 0.073                        | 0.042          |
| technical_action                           | 0.022                        | 0.008          |
| prediction_weekday                         | 0.006                        | 0.041          |
| is_warranty                                | 0.003                        | 0.002          |
| technician_catalog_jobs_before             | -0.030                       | 0.063          |
| technician_id                              | -0.039                       | 0.065          |
| technician_jobs_completed_before           | -0.070                       | 0.062          |
| technician_average_duration_before         | -0.078                       | 0.077          |
| prediction_month                           | -0.108                       | 0.054          |

## L. Subgroup errors

Sample count must accompany MAE/RMSE; small groups must not be overinterpreted.

### technician_id

| group   | sample_count | mae    | rmse   |
| ------- | ------------ | ------ | ------ |
| TECH_11 | 79           | 39.110 | 58.309 |
| TECH_09 | 54           | 35.557 | 50.170 |
| TECH_12 | 52           | 34.348 | 49.569 |
| TECH_01 | 72           | 31.359 | 47.591 |
| TECH_02 | 68           | 30.740 | 39.562 |
| TECH_04 | 66           | 29.507 | 41.621 |
| TECH_06 | 58           | 27.423 | 35.955 |
| TECH_10 | 66           | 25.876 | 34.469 |
| TECH_05 | 73           | 25.559 | 42.243 |
| TECH_07 | 71           | 25.394 | 33.008 |
| TECH_03 | 40           | 24.900 | 35.923 |
| TECH_08 | 51           | 20.358 | 30.296 |
### device_type

| group       | sample_count | mae    | rmse   |
| ----------- | ------------ | ------ | ------ |
| MacBook     | 118          | 45.266 | 61.772 |
| iPad        | 106          | 34.887 | 46.182 |
| AirPods     | 68           | 27.973 | 37.874 |
| Apple Watch | 77           | 25.223 | 36.625 |
| iPhone      | 381          | 24.171 | 36.169 |
### service_issue

| group         | sample_count | mae    | rmse   |
| ------------- | ------------ | ------ | ------ |
| Mainboard     | 61           | 64.476 | 88.264 |
| Bàn phím      | 20           | 53.129 | 64.252 |
| Âm thanh      | 23           | 37.511 | 51.765 |
| Màn hình      | 195          | 30.656 | 41.784 |
| Cổng sạc      | 52           | 27.752 | 36.887 |
| Hộp sạc       | 16           | 25.468 | 30.226 |
| Chống ồn      | 14           | 24.720 | 29.284 |
| Digital Crown | 19           | 22.401 | 27.170 |
| Pin           | 308          | 22.169 | 30.219 |
| Pin tai nghe  | 10           | 21.297 | 28.418 |
| Camera        | 21           | 19.709 | 22.879 |
| Sạc không dây | 11           | 16.317 | 18.988 |
### technical_action

| group       | sample_count | mae    | rmse   |
| ----------- | ------------ | ------ | ------ |
| REPAIR      | 196          | 38.978 | 57.927 |
| REPLACEMENT | 554          | 26.089 | 35.998 |
### is_warranty

| group | sample_count | mae    | rmse   |
| ----- | ------------ | ------ | ------ |
| 0     | 655          | 29.855 | 43.480 |
| 1     | 95           | 26.716 | 38.012 |

## M. Cold start

~~~json
{
  "known_history": 92.53308868408203,
  "new_technician": 97.77344512939453,
  "overall_but_no_issue_history": 97.41722106933594,
  "issue_but_no_catalog_history": 95.10682678222656,
  "unseen_categories": 98.80693817138672
}
~~~

All five scenarios are finite: known history; new KTV; overall but no current
issue; issue but no exact catalog; unseen categories.

## N. Artifact and verification

- Model: model.joblib (joblib containing the fitted preprocessing pipeline and estimator)
- Size: 199,256 bytes
- Python 3.13.6; sklearn
  1.8.0; XGBoost
  3.2.0; CatBoost
  1.2.8.
- Detailed folds: cv_fold_metrics.json
- Predictions: test_predictions.csv
- Contract: feature_contract.json
- Subgroups: subgroup_errors.json

## O. Explicit limits

- synthetic only: yes;
- production validated: no;
- runtime integrated: no;
- satisfaction classifier: absent;
- real DB extractor: not implemented;
- ML does not control ETA or assignment.

V3 metrics are synthetic experiment evidence, not production accuracy.
