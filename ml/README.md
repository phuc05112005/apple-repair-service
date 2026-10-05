# ML Experiment V1 — Repair Technical Duration Regression

This directory contains an **offline, reproducible ML experiment** for the only
ML problem approved for Apple Repair Service:

> Predict the active technical minutes needed to process one repair job.

The model predicts duration. It does not predict an estimated completion time.
The operational ETA engine may later combine a duration prediction with queue,
technician schedule, configured break and current state. Queue time,
`WAITING_PART`, `WAITING_APPROVAL`, break and handover waiting are not part of
the target.

## Scope and audit decision

The V1 sample is a completed service ticket with:

- exactly one approved repair item whose catalog plan was already known at the
  prediction timestamp;
- exactly one technician assignment;
- no accepted transfer and no assignment created from a transfer;
- complete, continuous service-status history;
- a recorded technical completion time.

This restriction is intentional. The current schema measures active time at
ticket/status and assignment level, not per repair item. It would be incorrect
to distribute a ticket duration among several items or to assign the total to
every technician after a transfer.

The production target is the sum of intervals in `INSPECTING` and `REPAIRING`,
intersected with the single assignment interval. The current
`RepairDurationService` and `TimingMetricsService` do not subtract persisted
`service_interruptions`; V1 documents that limitation and does not claim
otherwise.

See [DATA_CONTRACT.md](DATA_CONTRACT.md) for the source audit, exact inclusion
rules, feature provenance, leakage rules and future production extraction.

## Files

| File | Purpose |
|---|---|
| `generate_synthetic_repair_duration.py` | Deterministic controlled generator; never connects to MySQL |
| `data/synthetic_repair_duration_v1.csv` | 5,000 chronological synthetic samples |
| `01_repair_duration_regression.ipynb` | Executable EDA, pipelines, temporal CV, tuning and test evaluation |
| `DATA_CONTRACT.md` | Production mapping and leakage contract |
| `tests/test_synthetic_repair_duration.py` | Generator, schema and temporal-history tests |
| `requirements.txt` | Versions verified for this experiment |

Legacy empty directories remain only to avoid deleting the existing project
scaffold. No FastAPI service, Spring client or production model integration is
implemented in this phase.

## Reproduce

From the repository root:

```powershell
python -m pip install -r ml/requirements.txt
python ml/generate_synthetic_repair_duration.py
python -m pytest ml/tests -q
Push-Location ml
python -m jupyter nbconvert --to notebook --execute --inplace `
  --ExecutePreprocessor.timeout=600 01_repair_duration_regression.ipynb
Pop-Location
```

The generator seed is `20261005`. Running it again with the same source and
seed produces the same CSV. The notebook reads the existing CSV; it does not
generate training data in a cell.

## Experiment protocol

- Earliest 85%: development set.
- Latest 15%: untouched test set.
- Model selection and small hyperparameter searches: `TimeSeriesSplit` on the
  development set only.
- EDA and preprocessing fit: development/train folds only.
- Locked winner: chosen by cross-validated MAE before test metrics are read.
- Final report: MAE, MSE, RMSE and R² for mean baseline, production
  standard-duration baseline, Linear Regression, Decision Tree and Random
  Forest.

Categorical preprocessing uses `SimpleImputer` and
`OneHotEncoder(handle_unknown="ignore")`. Numeric preprocessing uses a median
imputer; the linear pipeline also scales numeric columns. Every learned
preprocessing step is inside its model `Pipeline`.

## Synthetic-data boundary

The CSV is compatible with the current production feature contract but contains
no production rows, customer identity, phone, serial number, account or free
text. Its target is produced from hidden technician, specialty, branch and case
factors plus controlled noise and a small outlier proportion. Hidden generator
parameters are not exported as model features.

Synthetic results validate the research pipeline only. They do not establish
accuracy on real repairs and must not be used as a production performance
claim.

## Explicit exclusions

- No satisfaction classification, satisfaction dataset or risk score.
- `service_feedbacks` remains a business/statistics feature and is not an ML
  input here.
- No Spring Boot, frontend, ETA, recommendation or business-rule changes.
- No FastAPI endpoint, runtime call, deployment or write to `ml_predictions`.
- No model binary is committed in V1.
