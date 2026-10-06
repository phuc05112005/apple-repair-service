"""Render EXPERIMENT_RESULTS.md from the completed V2 artifact files."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "synthetic_repair_duration_v2.csv"
ARTIFACTS = ROOT / "models" / "experimental_v2"
OUTPUT = ROOT / "EXPERIMENT_RESULTS.md"


def markdown_table(rows: list[dict], columns: list[tuple[str, str]]) -> str:
    header = "| " + " | ".join(label for _, label in columns) + " |"
    rule = "|" + "|".join("---" for _ in columns) + "|"
    lines = [header, rule]
    for row in rows:
        values = []
        for key, _ in columns:
            value = row.get(key, "")
            if isinstance(value, float):
                value = f"{value:.3f}"
            values.append(str(value).replace("|", "\\|"))
        lines.append("| " + " | ".join(values) + " |")
    return "\n".join(lines)


metadata = json.loads((ARTIFACTS / "metadata.json").read_text(encoding="utf-8"))
metrics = json.loads((ARTIFACTS / "metrics.json").read_text(encoding="utf-8"))
frame = pd.read_csv(DATA, parse_dates=["prediction_timestamp", "completed_at"])
target = frame["actual_technical_minutes"]
cv_rows = metrics["development_cv"]
test_rows = metrics["untouched_test"]
winner_cv = next(row for row in cv_rows if row["model"] == metrics["winner"])
winner_test = next(row for row in test_rows if row["model"] == metrics["winner"])

cv_table = markdown_table(
    cv_rows,
    [
        ("model", "Model"), ("cv_mae_mean", "CV MAE mean"),
        ("cv_mae_std", "CV MAE std"), ("cv_mse", "CV MSE"),
        ("cv_rmse", "CV RMSE"), ("cv_r2", "CV R²"),
        ("cv_p90_absolute_error", "CV P90AE"),
    ],
)
test_table = markdown_table(
    test_rows,
    [
        ("model", "Model"), ("mae", "Test MAE"), ("mse", "Test MSE"),
        ("rmse", "Test RMSE"), ("r2", "Test R²"),
        ("p90_absolute_error", "Test P90AE"),
        ("fit_seconds", "Fit seconds"), ("predict_seconds", "Predict seconds"),
    ],
)

subgroup_sections = []
for column, rows in metrics["subgroup_errors"].items():
    subgroup_sections.append(
        f"### `{column}`\n\n"
        + markdown_table(rows, [("group", "Group"), ("sample_count", "N"), ("mae", "MAE"), ("rmse", "RMSE")])
    )

importance_table = markdown_table(
    metrics["feature_importance"],
    [
        ("feature", "Feature"),
        ("importance_mean_mae_increase", "Mean MAE increase"),
        ("importance_std", "Std"),
    ],
)

device_rows = [
    {"device": key, "rows": int(value), "percent": float(value / len(frame) * 100)}
    for key, value in frame.device_type.value_counts().items()
]
service_rows = [
    {"service": key, "rows": int(value), "percent": float(value / len(frame) * 100)}
    for key, value in frame.service_type.value_counts().items()
]
technician_rows = [
    {"technician": key, "rows": int(value), "percent": float(value / len(frame) * 100)}
    for key, value in frame.technician_id.value_counts().items()
]
branch_rows = [
    {"branch": key, "rows": int(value), "percent": float(value / len(frame) * 100)}
    for key, value in frame.branch_id.value_counts().items()
]
missing = frame.isna().sum()
missing = {key: int(value) for key, value in missing[missing.gt(0)].items()}

search_text = "\n\n".join(
    f"### {name}\n\nBest parameters:\n\n```json\n{json.dumps(params, ensure_ascii=False, indent=2)}\n```\n\n"
    f"Search space:\n\n```json\n{json.dumps(metadata['search_spaces'][name], ensure_ascii=False, indent=2)}\n```"
    for name, params in metadata["all_best_hyperparameters"].items()
)
prediction_rows = pd.read_csv(ARTIFACTS / "test_predictions.csv")
residual = prediction_rows["residual_minutes"]

content = f"""# Experiment Results V2 — Repair Technical Duration Regression

Ngày chạy: `{metadata['training_timestamp']}`. Nhãn artifact:
**{metadata['artifact_label']}**.

## A. Dataset identity

- File: `ml/data/synthetic_repair_duration_v2.csv`
- SHA-256: `{metadata['dataset_sha256']}`
- Shape: **{len(frame):,} rows × {len(frame.columns)} columns**
- Prediction range: `{frame.prediction_timestamp.min().isoformat()}` → `{frame.prediction_timestamp.max().isoformat()}`
- Completion max: `{frame.completed_at.max().isoformat()}`
- Technicians: **{frame.technician_id.nunique()}**; branches: **{frame.branch_id.nunique()}**
- Duplicated full rows: **{int(frame.duplicated().sum())}**
- Intentional missing: `{json.dumps(missing, ensure_ascii=False)}`

Target minutes: mean **{target.mean():.3f}**, median **{target.median():.3f}**,
std **{target.std():.3f}**, P95 **{target.quantile(.95):.3f}**, min **{target.min()}**,
max **{target.max()}**.

### Device distribution

{markdown_table(device_rows, [('device','Device'),('rows','Rows'),('percent','Percent')])}

### Service-type distribution

{markdown_table(service_rows, [('service','Service type'),('rows','Rows'),('percent','Percent')])}

### Technician distribution

{markdown_table(technician_rows, [('technician','Technician'),('rows','Rows'),('percent','Percent')])}

### Branch distribution

{markdown_table(branch_rows, [('branch','Branch'),('rows','Rows'),('percent','Percent')])}

## B. Experimental contract

Sample là completed ticket có đúng một approved item, một assignment, không
transfer và history đầy đủ. Target là phút `INSPECTING + REPAIRING` giao với
assignment. Persisted `service_interruptions` chưa được production duration
service tự trừ. Có đúng 14 feature theo `DATA_CONTRACT.md`; history tuân thủ
`previous_job.completed_at < current_prediction_timestamp`.

## C. Temporal split and CV

- `{metadata['split_policy']['policy']}`
- Development: **{metadata['split_policy']['development_rows']}** rows,
  `{metadata['split_policy']['development_start']}` → `{metadata['split_policy']['development_end']}`
- Holdout: **{metadata['split_policy']['test_rows']}** rows,
  `{metadata['split_policy']['test_start']}` → `{metadata['split_policy']['test_end']}`
- CV: `{metadata['split_policy']['cv']}`; identical folds for all models.
- Primary scoring: MAE. Holdout was excluded from selection and tuning.

Fold configuration:

{markdown_table(metadata['split_policy']['folds'], [('fold','Fold'),('train_rows','Train rows'),('validation_rows','Validation rows'),('train_end','Train end'),('validation_start','Validation start'),('validation_end','Validation end')])}

## D. Hyperparameter tuning

Each candidate used eight fixed-seed `RandomizedSearchCV` configurations. The
four candidates received the same folds, metric, dataset and comparable search
effort; preprocessing remained model-appropriate.

Preprocessing:

{markdown_table([{'model': key, 'preprocessing': value} for key, value in metadata['preprocessing'].items()], [('model','Model'),('preprocessing','Preprocessing')])}

{search_text}

## E. Development temporal-CV comparison

{cv_table}

CV MAE of locked winner: **{winner_cv['cv_mae_mean']:.3f} ± {winner_cv['cv_mae_std']:.3f} minutes**.

## F. Locked winner and selection reason

**Winner: {metrics['winner']}**

{metrics['winner_reason']}

The policy was declared before opening holdout: lowest development temporal-CV
MAE; candidates within 0.25 minute use CV stability, RMSE, P90AE and complexity.

## G. Untouched-test comparison

{test_table}

Winner versus standard-duration baseline:

- absolute MAE improvement: **{metrics['winner_improvement_vs_standard_duration_mae_minutes']:.3f} minutes**;
- relative MAE improvement: **{metrics['winner_improvement_vs_standard_duration_mae_percent']:.3f}%**;
- winner test P90 absolute error: **{winner_test['p90_absolute_error']:.3f} minutes**.

These are synthetic holdout metrics, not production accuracy.

## H. Residual and error diagnostics

The executable run saved `diagnostics.png` with actual-vs-predicted, residual
versus predicted, residual distribution and absolute-error/P90 panels. Signed
residual is `actual - prediction`; positive means underprediction. Raw holdout
rows and errors are in `test_predictions.csv`.

Residual summary: mean **{residual.mean():.3f}**, median **{residual.median():.3f}**,
standard deviation **{residual.std():.3f}**, min **{residual.min():.3f}**, max
**{residual.max():.3f}** minutes.

## I. Subgroup errors

Every row includes sample count; groups with small N must not be overinterpreted.

{chr(10).join(subgroup_sections)}

## J. Cold start

```json
{json.dumps(metrics['cold_start_predictions'], ensure_ascii=False, indent=2)}
```

Known history, a new technician with counts 0/history missing, and unseen
categories all produced finite predictions without inventing prior jobs.

## K. Feature importance

Permutation importance is the increase in holdout MAE after shuffling one
original feature. Importance is predictive association, **not causality**.

{importance_table}

## L. Runtime and artifact

- Winner model file: `{metadata['model_file']}`
- Format: {metadata['artifact_format']}
- Artifact size: **{metadata['artifact_size_bytes']:,} bytes**
- Winner full-development fit: **{winner_test['fit_seconds']:.3f} s**
- Winner holdout prediction: **{winner_test['predict_seconds']:.3f} s** for {metadata['split_policy']['test_rows']} rows
- Environment: Python {metadata['library_versions']['python']}, sklearn {metadata['library_versions']['scikit_learn']}, XGBoost {metadata['library_versions']['xgboost']}, CatBoost {metadata['library_versions']['catboost']}.

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
"""

OUTPUT.write_text(content, encoding="utf-8")
print(f"Wrote {OUTPUT}")
