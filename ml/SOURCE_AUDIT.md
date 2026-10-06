# Source audit for ML Experiment V2

Audit date: 2026-10-05. The external course directory was read-only and was not
modified. Only `ml/` in the Apple Repair Service repository was changed.

## Course material actually read

| File | Applied principle |
|---|---|
| `D:\Class\AI\Hoc_may_Hoi_quy_Phan_loai\01_Hoi_quy.ipynb` | Regression framing; mean baseline; OLS/tree/Random Forest theory; MAE/MSE/RMSE/R²; pipeline; CV; Restart Kernel → Run All discipline. |
| `D:\Class\AI\Hoc_may_Hoi_quy_Phan_loai\02_Phan_loai.ipynb` | Confirmed the distinction between regression and classification and avoided confusion matrix, precision/recall/F1/ROC in this experiment. |
| `D:\Class\AI\Hoc_may_Hoi_quy_Phan_loai\apple_repair_ml_study\docs\01_COURSE_KNOWLEDGE_MAP.md` | Mapped course topics to duration regression; retained temporal validation and train-only preprocessing. |
| `D:\Class\AI\Hoc_may_Hoi_quy_Phan_loai\apple_repair_ml_study\docs\02_REGRESSION_THEORY.md` | Checked target formula, Random Forest averaging, boosting, XGBoost gradients/Hessian and metric interpretations. |
| `D:\Class\AI\Hoc_may_Hoi_quy_Phan_loai\apple_repair_ml_study\docs\04_EXPERIMENT_DESIGN.md` | Preserved snapshot → temporal split → selection → one-time holdout evaluation and synthetic-data limitations. |
| `D:\Class\AI\Bao_cao_Hoi_quy_va_Phan_loai.md` | Reused the leakage corrections: split before learned preprocessing, do not tune on test, preserve the fitted pipeline, and do not interpret R² as accuracy. |

The V2 formulas for P90AE and CatBoost ordered target statistics extend beyond
the older course baseline. They are explained in the notebook without claiming
the simplified ordered-statistic formula describes all of CatBoost.

## Application source actually checked

| File | Audit result |
|---|---|
| `src/main/java/.../service/RepairDurationService.java` | Active status is exactly `INSPECTING` or `REPAIRING`; history must be continuous and ordered. |
| `src/main/java/.../service/TimingMetricsService.java` | Technician attribution intersects active status intervals with assignment intervals. |
| `src/main/java/.../entity/ServiceInterruption.java` | Interruption persistence exists with assignment/start/end/reason fields. |
| `database/schema.sql` | Confirmed assignments, histories, repair items, catalog relations and `service_interruptions`; no complete canonical master-data seed. |
| `database/migrate_service_types_20260920.sql` | Contains a narrow catalog migration insert, not a complete supported-device catalog. |
| Existing V1 files under `ml/` | Retained the conservative sample grain, 14 leakage-safe features, strict completion-time history and V1 dataset for audit. |

## Decisions from the audit

- Keep one completed ticket with one approved item, one assignment, no transfer
  and complete history as the sample grain.
- Reconstruct target from active status intervals intersected with assignment.
- Do not claim persisted interruptions are subtracted; production services do
  not yet do that.
- Keep the V1 feature contract because all 14 values are derivable and known at
  prediction time.
- Use a versioned controlled synthetic catalog across iPhone, iPad, MacBook,
  Apple Watch and AirPods. Do not claim those labels are live master data.
- Select only by development temporal CV; use the latest 15% exactly once after
  winner lock.
- Compare two baselines plus Random Forest, HGB, XGBoost and CatBoost; do not
  reintroduce the satisfaction classifier.
