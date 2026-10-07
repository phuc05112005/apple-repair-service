# Repair-duration ML experiment

This directory is the final research/training baseline for predicting **active
technical minutes** in Apple Repair Service. It is deliberately isolated from
Spring Boot, MySQL, ETA, `ml_predictions`, frontend and deployment code.

> **EXPERIMENTAL_DEMO — synthetic data only — runtime available — not production validated.**

## Reproduce

From the repository root:

```powershell
python -m pip install -r ml/requirements.txt
python ml/generate_synthetic_repair_duration.py
python -m pytest ml/tests -q
python ml/train_repair_duration_models.py
python ml/build_repair_duration_notebook.py
```

Then restart the notebook kernel and run all cells in
`ml/repair_duration_regression.ipynb`.

## Final structure

- `repair_duration_regression.ipynb`: one end-to-end auditable notebook.
- `generate_synthetic_repair_duration.py`: deterministic 5,000-row generator,
  seed `20261007`.
- `train_repair_duration_models.py`: full temporal model competition CLI.
- `src/repair_duration_ml/`: reusable contract, data, features, models,
  evaluation and training code.
- `data/synthetic_repair_duration.csv`: controlled synthetic dataset.
- `models/experimental/`: locked experimental artifact and evidence tables.
- `DATA_CONTRACT.md`: target, sample grain, time and leakage rules.
- `EXPERIMENT_RESULTS.md`: exact run results and limitations.

Only `RandomForestRegressor`, `XGBRegressor` and `CatBoostRegressor` are final
candidates. Selection uses development `TimeSeriesSplit(4)` MAE. The last 15%
chronological holdout remains untouched until the winner is locked.

## Real Data Bridge

The read-only MySQL bridge is documented in `REAL_DATA_SOURCE_AUDIT.md` and
`REAL_DATA_CONTRACT.md`. It transforms only provably eligible completed tickets
into the same frozen 20-feature schema and never trains or replaces the current
experimental artifact.

Run it with database credentials supplied only through `DB_HOST`, `DB_PORT`,
`DB_NAME`, `DB_USER`, and `DB_PASSWORD`:

```bash
python ml/extract_real_repair_duration_dataset.py
```

Use `--dry-run` to validate without writing the CSV/JSON snapshot.

## Internal runtime

The Python runtime is isolated from Spring Boot and uses read-only MySQL access.
It returns predicted technical minutes for an ordered candidate list; it does
not rank, recommend, assign, calculate ETA, or persist predictions.

```powershell
$env:DB_HOST='localhost'
$env:DB_PORT='3307'
$env:DB_NAME='apple_repair_service'
$env:DB_USER='<read-only-user>'
$env:DB_PASSWORD='<password>'
python ml/run_runtime_api.py
```

Endpoints are `/health/live`, `/health/ready`, `/api/v1/model-info`, and
`/api/v1/repair-duration/predict-candidates`. See
`RUNTIME_INFERENCE_REPORT.md` and `RUNTIME_INFERENCE_STATUS.md`.

| Gate | Status |
|---|---|
| Final ML Research | PASS |
| Real Data Bridge | PASS — functional, 0 real samples |
| Runtime Inference Core | PASS |
| Internal ML API | PASS |
