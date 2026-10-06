"""Build the V2 research notebook from auditable source cells."""

from __future__ import annotations

from pathlib import Path

import nbformat as nbf

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "01_repair_duration_regression.ipynb"


def md(text: str):
    return nbf.v4.new_markdown_cell(text.strip())


def code(text: str):
    return nbf.v4.new_code_cell(text.strip())


cells = [
    md(r"""
# 1. Repair Duration Regression — Model Competition V2

Thực nghiệm hồi quy số phút kỹ thuật chủ động cho Apple Repair Service.
**EXPERIMENTAL — SYNTHETIC-DATA TRAINED — NOT PRODUCTION VALIDATED.**
"""),
    md("""
## 2. Business problem

Cửa hàng cần một ước lượng thời lượng kỹ thuật để hỗ trợ lập ETA và điều phối.
Kết quả mô hình không tự nó là ETA và không tự quyết định phân công.
"""),
    md(r"""
## 3. ML problem

Với $D=\{(x_i,y_i)\}_{i=1}^{n}$, mô hình hồi quy học
$\hat y_i=f(x_i)$, trong đó $y_i$ là `actual_technical_minutes`.
"""),
    md("""
## 4. Prediction-time definition

Thời điểm dự đoán là assignment đầu tiên sau khi phương án một hạng mục APPROVED
đã biết. Mọi feature phải tồn tại tại hoặc trước thời điểm này.
"""),
    md("""
## 5. Sample grain

Một completed ticket, đúng một approved repair item, một assignment, không
transfer và status history liên tục. Schema hiện không có timer per-item nên
không phân bổ giả thời lượng cho phiếu nhiều hạng mục.
"""),
    md(r"""
## 6. Target definition

$$y=\frac1{60}\sum_{k:u_k\in\{INSPECTING,REPAIRING\}}
\max(0,\min(e_k,a_e)-\max(s_k,a_s))_{seconds}.$$

Không tính queue, chờ khách, chờ linh kiện, break, transfer gap hay chờ bàn giao.
Persistence interruption hiện chưa được duration service tự trừ.
"""),
    md("""
## 7. Synthetic limitation

V2 dùng controlled synthetic catalog vì repository không có full canonical
master seed. Quan hệ device→model→issue→service hợp lý nhưng không được xem là
record production. Hidden target factors không được xuất ra dataset.
"""),
    md("## 8. Imports, seed and library versions"),
    code("""
%matplotlib inline
from pathlib import Path
import sys, platform
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import sklearn, xgboost, catboost

ML_ROOT = Path('ml') if Path('ml').exists() else Path.cwd()
sys.path.insert(0, str((ML_ROOT / 'src').resolve()))
from repair_duration_ml.config import *
from repair_duration_ml.data import load_dataset, temporal_holdout_split, feature_target
from repair_duration_ml.models import build_model_specs
from repair_duration_ml.training import (
    _baseline_cv_rows, _tune_candidate, _test_candidate, select_winner
)
from repair_duration_ml.evaluation import (
    cold_start_examples, feature_importance, subgroup_errors
)
from sklearn.model_selection import TimeSeriesSplit

np.random.seed(SEED)
versions = {
    'python': platform.python_version(), 'numpy': np.__version__,
    'pandas': pd.__version__, 'scikit-learn': sklearn.__version__,
    'xgboost': xgboost.__version__, 'catboost': catboost.__version__,
    'seed': SEED,
}
versions
"""),
    md("## 9. Load dataset"),
    code("""
DATA_PATH = ML_ROOT / 'data' / 'synthetic_repair_duration_v2.csv'
frame = load_dataset(DATA_PATH)
frame.head(3)
"""),
    md("## 10. Dataset validation"),
    code("""
{
    'shape': frame.shape,
    'duplicates': int(frame.duplicated().sum()),
    'chronological': bool(frame.prediction_timestamp.is_monotonic_increasing),
    'missing': frame.isna().sum()[frame.isna().sum().gt(0)].to_dict(),
    'devices': frame.device_type.value_counts().to_dict(),
}
"""),
    md("""
## 11. Data dictionary and features

14 features gồm 5 numeric và 9 categorical. `DATA_CONTRACT.md` ánh xạ từng
feature về nguồn DB, availability, leakage risk và cold-start rule.
"""),
    code("{'numeric': NUMERIC_FEATURES, 'categorical': CATEGORICAL_FEATURES}"),
    md("""
## 12. Excluded columns

`sample_id`, `prediction_timestamp`, `completed_at` và target phục vụ audit,
không vào X. Không dùng feedback, PII, future status, ETA error, serial, free
text, prediction cũ hoặc hidden synthetic factors.
"""),
    md("## 13. Temporal split"),
    code("""
split = temporal_holdout_split(frame, test_fraction=0.15)
X_dev, y_dev = feature_target(split.development)
X_test, y_test = feature_target(split.test)
folds = list(TimeSeriesSplit(n_splits=4).split(X_dev))
{
    'development_rows': len(X_dev), 'test_rows': len(X_test),
    'development_end': split.development.prediction_timestamp.max(),
    'test_start': split.test.prediction_timestamp.min(),
    'fold_sizes': [(len(a), len(b)) for a, b in folds],
}
"""),
    md("## 14. Train-only EDA"),
    code("""
split.development.groupby(['device_type', 'service_type'], observed=True).agg(
    samples=(TARGET, 'size'), mean_minutes=(TARGET, 'mean'), median_minutes=(TARGET, 'median')
).round(2)
"""),
    md("## 15. Target distribution"),
    code("""
ax = y_dev.hist(bins=40, figsize=(9, 4), color='#2563eb', alpha=.8)
ax.set(title='Development target distribution', xlabel='Actual technical minutes', ylabel='Count')
plt.show()
y_dev.describe(percentiles=[.5, .9, .95]).round(2)
"""),
    md("## 16. Numeric relationships"),
    code("split.development[NUMERIC_FEATURES + [TARGET]].corr(numeric_only=True).round(3)"),
    md("## 17. Category distributions"),
    code("""
{column: split.development[column].value_counts().head(8).to_dict()
 for column in ['device_type', 'service_issue', 'service_type', 'technician_id']}
"""),
    md("""
## 18. Leakage discussion

History uses only `previous_job.completed_at < prediction_timestamp`. Không
`groupby` toàn dataset rồi backfill. Preprocessing được fit trong từng temporal
fold. Holdout 15% cuối chưa được đọc khi tuning và khóa winner.
"""),
    md(r"""
## 19. Baselines and regression metrics

Mean baseline học $\bar y_{train}$; business baseline dùng
$\hat y=standard\_duration\_minutes$.

$$MAE=\frac1n\sum|y_i-\hat y_i|,\quad
MSE=\frac1n\sum(y_i-\hat y_i)^2,\quad RMSE=\sqrt{MSE}.$$
$$R^2=1-\frac{\sum(y_i-\hat y_i)^2}{\sum(y_i-\bar y)^2}.$$
Với $AE_i=|y_i-\hat y_i|$, $P90AE=percentile_{90}(\{AE_i\})$; 90% dự đoán có
sai số tuyệt đối không vượt mức này. $R^2$ không phải phần trăm accuracy.
"""),
    code("""
baseline_rows, fold_metrics = _baseline_cv_rows(X_dev, y_dev, folds)
cv_rows = list(baseline_rows)
best_estimators, best_parameters = {}, {}
pd.DataFrame(baseline_rows)
"""),
    md(r"""
## 20. Theory — Random Forest

$$\hat y_{RF}(x)=\frac1B\sum_{b=1}^{B}T_b(x).$$
Mỗi cây học từ bootstrap sample và subset feature ngẫu nhiên. Trung bình nhiều
cây giảm variance. Split hồi quy tối thiểu hóa tổng squared errors hai nút con.
"""),
    md("## 21. Train/tune Random Forest"),
    code("""
specs = build_model_specs(smoke=False)
name = 'RandomForestRegressor'
est, params, summary, rows, _ = _tune_candidate(name, specs[name], X_dev, y_dev, folds, 8)
best_estimators[name], best_parameters[name], fold_metrics[name] = est, params, rows
cv_rows.append({'model': name, **summary})
params, summary
"""),
    md(r"""
## 22. Theory — HistGradientBoosting

$$F_0(x)=initial,\qquad F_m(x)=F_{m-1}(x)+\eta h_m(x).$$
Với squared-error intuition, $r_i^{(m)}=y_i-F_{m-1}(x_i)$ và learner mới học
residual/negative gradient. Histogram binning gom giá trị feature để tìm split
hiệu quả; đó không phải target binning. HGB dùng ordinal dense + native
categorical splits, không nhận sparse one-hot không phù hợp.
"""),
    md("## 23. Train/tune HistGradientBoosting"),
    code("""
name = 'HistGradientBoostingRegressor'
est, params, summary, rows, _ = _tune_candidate(name, specs[name], X_dev, y_dev, folds, 8)
best_estimators[name], best_parameters[name], fold_metrics[name] = est, params, rows
cv_rows.append({'model': name, **summary})
params, summary
"""),
    md(r"""
## 24. Theory — XGBoost

$$Obj^{(t)}=\sum_i l(y_i,\hat y_i^{(t-1)}+f_t(x_i))+\Omega(f_t),$$
$$\Omega(f)=\gamma T+\frac12\lambda\lVert w\rVert^2.$$
XGBoost dùng Taylor bậc hai với
$g_i=\partial l/\partial\hat y_i$ và
$h_i=\partial^2l/\partial\hat y_i^2$. $T$ là số leaf; $w$ là leaf weights;
$\gamma,\lambda$ kiểm soát độ phức tạp. Row/feature subsampling giúp regularize.
"""),
    md("## 25. Train/tune XGBoost"),
    code("""
name = 'XGBRegressor'
est, params, summary, rows, _ = _tune_candidate(name, specs[name], X_dev, y_dev, folds, 8)
best_estimators[name], best_parameters[name], fold_metrics[name] = est, params, rows
cv_rows.append({'model': name, **summary})
params, summary
"""),
    md(r"""
## 26. Theory — CatBoost

CatBoost là gradient-boosted trees với xử lý categorical native. Ordered target
statistic minh họa có smoothing:

$$TS_i=\frac{\sum_{j:\sigma(j)<\sigma(i)}\mathbf1[x_j=x_i]y_j+aP}
{\sum_{j:\sigma(j)<\sigma(i)}\mathbf1[x_j=x_i]+a}.$$

$\sigma$ là permutation, $P$ là prior, $a$ là smoothing. Mẫu hiện tại không
dùng trực tiếp target của chính nó để encode category. Đây là nguyên lý minh
họa, không phải toàn bộ thuật toán CatBoost; ordered boosting tiếp tục giảm
prediction shift/leakage.
"""),
    md("## 27. Train/tune CatBoost"),
    code("""
name = 'CatBoostRegressor'
est, params, summary, rows, _ = _tune_candidate(name, specs[name], X_dev, y_dev, folds, 8)
best_estimators[name], best_parameters[name], fold_metrics[name] = est, params, rows
cv_rows.append({'model': name, **summary})
params, summary
"""),
    md("## 28. Temporal CV comparison"),
    code("""
cv_table = pd.DataFrame(cv_rows).sort_values('cv_mae_mean').reset_index(drop=True)
cv_table[['model','cv_mae_mean','cv_mae_std','cv_mse','cv_rmse','cv_r2','cv_p90_absolute_error']].round(3)
"""),
    md("""
## 29. Lock winner

Winner dùng development CV MAE. Chênh ≤0,25 phút là near tie; lần lượt xét
CV-MAE std, RMSE, P90AE và complexity. Test chưa tham gia quyết định.
"""),
    code("winner_name, winner_reason = select_winner(cv_table); (winner_name, winner_reason)"),
    md("## 30. Untouched test evaluation"),
    code("""
test_rows = []
from repair_duration_ml.evaluation import regression_metrics
mean_pred = np.full(len(y_test), y_dev.mean())
std_pred = X_test.standard_duration_minutes.to_numpy(float)
test_rows += [
    {'model':'MeanBaseline', **regression_metrics(y_test, mean_pred), 'fit_seconds':0., 'predict_seconds':0.},
    {'model':'StandardDurationBaseline', **regression_metrics(y_test, std_pred), 'fit_seconds':0., 'predict_seconds':0.},
]
fitted_models, predictions = {}, {}
for name in MODEL_NAMES:
    fitted, pred, metrics = _test_candidate(best_estimators[name], X_dev, y_dev, X_test, y_test)
    fitted_models[name], predictions[name] = fitted, pred
    test_rows.append({'model': name, **metrics})
test_table = pd.DataFrame(test_rows).sort_values('mae').reset_index(drop=True)
winner_estimator, winner_predictions = fitted_models[winner_name], predictions[winner_name]
test_table.round(3)
"""),
    md("## 31. Actual vs Predicted"),
    code("""
plt.figure(figsize=(6,5)); plt.scatter(y_test, winner_predictions, alpha=.35, s=15)
lo=min(y_test.min(), winner_predictions.min()); hi=max(y_test.max(), winner_predictions.max())
plt.plot([lo,hi],[lo,hi],'k--'); plt.xlabel('Actual'); plt.ylabel('Predicted'); plt.title(winner_name); plt.show()
"""),
    md("## 32. Residual analysis"),
    code("""
residual = y_test.to_numpy() - winner_predictions
fig, ax = plt.subplots(1,2,figsize=(11,4))
ax[0].scatter(winner_predictions,residual,alpha=.35,s=15); ax[0].axhline(0,color='k',ls='--')
ax[0].set(xlabel='Predicted',ylabel='Residual',title='Residual vs predicted')
ax[1].hist(residual,bins=35); ax[1].set(title='Residual distribution',xlabel='Actual - predicted')
plt.show()
pd.Series(residual).describe().round(2)
"""),
    md("## 33. P90 absolute-error analysis"),
    code("""
absolute_error = np.abs(residual); p90 = np.percentile(absolute_error,90)
plt.figure(figsize=(8,4)); plt.hist(absolute_error,bins=35); plt.axvline(p90,color='red',ls='--',label=f'P90={p90:.2f}')
plt.legend(); plt.xlabel('Absolute error (minutes)'); plt.show(); p90
"""),
    md("## 34. Subgroup errors"),
    code("""
subgroups = {c: subgroup_errors(split.test, winner_predictions, c)
             for c in ['technician_id','device_type','service_issue','service_type']}
{c: pd.DataFrame(rows).head(8) for c, rows in subgroups.items()}
"""),
    md("""
## 35. Feature importance and explainability

Permutation importance đo mức MAE tăng khi xáo trộn một feature trên holdout.
Importance cho biết giá trị dự báo của model, **không chứng minh quan hệ nhân quả**.
"""),
    code("pd.DataFrame(feature_importance(winner_estimator, X_test, y_test)).head(14).round(3)"),
    md("## 36. Cold-start predictions"),
    code("""
cold = cold_start_examples(X_dev)
pd.DataFrame({'scenario':cold.index, 'prediction':winner_estimator.predict(cold)})
"""),
    md("## 37. Example new-job prediction"),
    code("""
example = cold.loc[['new_technician']]
{'input': example.to_dict(orient='records')[0],
 'predicted_technical_minutes': float(winner_estimator.predict(example)[0])}
"""),
    md("""
## 38. Relationship to ETA

Prediction là active technical minutes. ETA engine tương lai mới kết hợp queue,
working schedule, break, current state và interruption semantics đã được chốt.
Phase này không ghi prediction vào Spring/MySQL và không đổi ETA hiện tại.
"""),
    md("""
## 39. Limitations

- synthetic distribution không chứng minh generalization ngoài thực tế;
- grain loại multi-item/transfer/incomplete history;
- persisted interruptions chưa được production duration service trừ;
- catalog là controlled synthetic catalog, không phải snapshot master thật;
- subgroup nhỏ phải đọc cùng sample count;
- permutation importance không phải causality.
"""),
    md("""
## 40. Next production-data phase

MySQL snapshot → leakage-safe real extractor → `real_repair_duration_vX` → cùng
feature contract/training pipeline → real temporal holdout → explicit approval
→ mới xem xét runtime integration.
"""),
    md("""
## 41. Final conclusion

Notebook khóa winner tự động bằng development temporal CV và chỉ sau đó mở
holdout. Kết luận phải đọc từ output thực tế phía trên. Artifact CLI vẫn là
**experimental, synthetic-data trained, not production validated**.
"""),
]

notebook = nbf.v4.new_notebook(
    cells=cells,
    metadata={
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.13"},
    },
)
nbf.write(notebook, OUTPUT)
print(f"Wrote {len(cells)} cells to {OUTPUT}")
