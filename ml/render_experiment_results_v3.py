"""Render EXPERIMENT_RESULTS_V3.md from the actual saved V3 artifacts."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
ARTIFACT = ROOT / "models" / "experimental_v3"
DATA = ROOT / "data" / "synthetic_repair_duration_v3.csv"
OUTPUT = ROOT / "EXPERIMENT_RESULTS_V3.md"


def read_json(name: str):
    return json.loads((ARTIFACT / name).read_text(encoding="utf-8"))


def table(frame: pd.DataFrame, decimals: int = 3) -> str:
    view = frame.copy()
    for column in view.select_dtypes(include="number").columns:
        if pd.api.types.is_integer_dtype(view[column]):
            view[column] = view[column].map(
                lambda value: str(int(value)) if pd.notna(value) else ""
            )
        else:
            view[column] = view[column].map(
                lambda value: f"{value:.{decimals}f}" if pd.notna(value) else ""
            )
    headers = [str(x) for x in view.columns]
    rows = [[str(x) for x in row] for row in view.itertuples(index=False, name=None)]
    widths = [
        max(len(headers[index]), *(len(row[index]) for row in rows))
        for index in range(len(headers))
    ]
    line = "| " + " | ".join(
        headers[index].ljust(widths[index]) for index in range(len(headers))
    ) + " |"
    separator = "| " + " | ".join("-" * width for width in widths) + " |"
    body = [
        "| " + " | ".join(row[index].ljust(widths[index]) for index in range(len(row))) + " |"
        for row in rows
    ]
    return "\n".join([line, separator, *body])


metadata = read_json("metadata.json")
metrics = read_json("metrics.json")
subgroups = read_json("subgroup_errors.json")
frame = pd.read_csv(DATA, parse_dates=["prediction_timestamp", "completed_at"])
cv = pd.read_csv(ARTIFACT / "development_cv_comparison.csv")
test = pd.read_csv(ARTIFACT / "test_comparison.csv")
importance = pd.read_csv(ARTIFACT / "feature_importance.csv")
predictions = pd.read_csv(ARTIFACT / "test_predictions.csv")
target = frame["actual_technical_minutes"]
winner_test = test[test.model.eq(metadata["winner_name"])].iloc[0]
standard_test = test[test.model.eq("StandardDurationBaseline")].iloc[0]
residual = predictions["residual_minutes"]

distribution_sections = []
for column in ["device_type", "technical_action", "is_warranty", "technician_id"]:
    values = frame[column].value_counts().rename_axis(column).reset_index(name="rows")
    values["percent"] = values["rows"] / len(frame) * 100
    distribution_sections.append(f"### {column}\n\n{table(values)}")

folds = pd.DataFrame(metadata["split_policy"]["folds"])
preprocessing = pd.DataFrame(
    [{"model": key, "preprocessing": value} for key, value in metadata["preprocessing"].items()]
)

search_sections = []
for model, space in metadata["search_spaces"].items():
    best = metadata["all_best_hyperparameters"][model]
    search_sections.append(
        "### " + model + "\n\nBest parameters:\n\n~~~json\n"
        + json.dumps(best, ensure_ascii=False, indent=2)
        + "\n~~~\n\nSearch space:\n\n~~~json\n"
        + json.dumps(space, ensure_ascii=False, indent=2)
        + "\n~~~"
    )

cv_columns = [
    "model", "cv_mae_mean", "cv_mae_std", "cv_mse", "cv_rmse", "cv_r2",
    "cv_p90_absolute_error", "cv_within_15_percent",
    "cv_within_30_percent", "cv_within_45_percent",
]
test_columns = [
    "model", "mae", "mse", "rmse", "r2", "p90_absolute_error",
    "within_15_percent", "within_30_percent", "within_45_percent",
    "fit_seconds", "predict_seconds",
]

subgroup_sections = []
for name, rows in subgroups.items():
    subgroup_sections.append("### " + name + "\n\n" + table(pd.DataFrame(rows)))

content = f"""# Experiment Results V3 — Repair Technical Duration Regression

Run time: {metadata['training_timestamp']}. Artifact label:
**EXPERIMENTAL — SYNTHETIC-DATA TRAINED — NOT PRODUCTION VALIDATED**.

## A. Files and experiment identity

- Dataset: ml/data/synthetic_repair_duration_v3.csv
- Artifact: ml/models/experimental_v3/
- Experiment version: {metadata['experiment_version']}
- Seed: {metadata['seed']}
- SHA-256: {metadata['dataset_sha256']}
- Shape: {len(frame):,} rows × {len(frame.columns)} columns
- Prediction range: {frame.prediction_timestamp.min().isoformat()} → {frame.prediction_timestamp.max().isoformat()}
- Completion max: {frame.completed_at.max().isoformat()}
- Duplicates: {int(frame.duplicated().sum())}
- Missing: {frame.isna().sum()[frame.isna().sum().gt(0)].to_dict()}

Target mean {target.mean():.3f}, std {target.std():.3f}, median
{target.median():.3f}, P95 {target.quantile(.95):.3f}, min {target.min():.0f},
max {target.max():.0f} minutes.

{chr(10).join(distribution_sections)}

## B. Warranty semantic

V3 replaces V2 service_type including WARRANTY with technical_action limited to
REPAIR/REPLACEMENT plus binary is_warranty. Warranty has no hidden technical
duration multiplier. Production mapping is documented in DATA_CONTRACT.md.

## C. Exact feature list

{json.dumps(metadata['features'], ensure_ascii=False, indent=2)}

## D. Temporal split and folds

- Policy: {metadata['split_policy']['policy']}
- Development: {metadata['split_policy']['development_rows']} rows,
  {metadata['split_policy']['development_start']} → {metadata['split_policy']['development_end']}
- Holdout: {metadata['split_policy']['test_rows']} rows,
  {metadata['split_policy']['test_start']} → {metadata['split_policy']['test_end']}
- CV: {metadata['split_policy']['cv']}

{table(folds)}

## E. Model preprocessing

{table(preprocessing)}

## F. Search effort and best parameters

Twelve fixed-seed randomized configurations were evaluated for each candidate
on the same four temporal folds, with neg_mean_absolute_error.

{chr(10).join(search_sections)}

## G. Development temporal-CV comparison

{table(cv[cv_columns])}

## H. Locked winner

**{metadata['winner_name']}**

{metadata['winner_selection_reason']}

## I. Untouched V3 holdout

{table(test[test_columns])}

Winner tolerance: ±15 = {winner_test.within_15_percent:.3f}%,
±30 = {winner_test.within_30_percent:.3f}%,
±45 = {winner_test.within_45_percent:.3f}%.

Versus StandardDurationBaseline: MAE improves by
{standard_test.mae - winner_test.mae:.3f} minutes
({(standard_test.mae - winner_test.mae) / standard_test.mae * 100:.3f}%).

## J. Residual summary

Residual is actual minus prediction. Mean {residual.mean():.3f}, median
{residual.median():.3f}, std {residual.std():.3f}, min {residual.min():.3f},
max {residual.max():.3f}. diagnostics.png contains actual/predicted, residual,
absolute-error and P90 panels.

## K. Feature importance

Permutation importance is predictive association, not causality.

{table(importance)}

## L. Subgroup errors

Sample count must accompany MAE/RMSE; small groups must not be overinterpreted.

{chr(10).join(subgroup_sections)}

## M. Cold start

~~~json
{json.dumps(metrics['cold_start_predictions'], ensure_ascii=False, indent=2)}
~~~

All five scenarios are finite: known history; new KTV; overall but no current
issue; issue but no exact catalog; unseen categories.

## N. Artifact and verification

- Model: {metadata['model_file']} ({metadata['artifact_format']})
- Size: {metadata['artifact_size_bytes']:,} bytes
- Python {metadata['library_versions']['python']}; sklearn
  {metadata['library_versions']['scikit_learn']}; XGBoost
  {metadata['library_versions']['xgboost']}; CatBoost
  {metadata['library_versions']['catboost']}.
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
"""

OUTPUT.write_text(content, encoding="utf-8")
print(f"Wrote {OUTPUT}")
