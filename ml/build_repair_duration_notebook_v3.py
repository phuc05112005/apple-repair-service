"""Build the auditable V3 notebook from source cells."""

from __future__ import annotations

from pathlib import Path

import nbformat as nbf

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "02_repair_duration_regression_v3.ipynb"


def md(value: str):
    return nbf.v4.new_markdown_cell(value.strip())


def code(value: str):
    return nbf.v4.new_code_cell(value.strip())


cells = [
    md("""
# 1. Business problem

Dự đoán số phút kỹ thuật chủ động cho một công việc sửa chữa Apple.
**EXPERIMENTAL — SYNTHETIC-DATA TRAINED — NOT PRODUCTION VALIDATED.**
Prediction này là đầu vào tiềm năng của ETA, không phải ETA trực tiếp.
"""),
    md(r"""
## 2. Regression formulation

Với tập $D=\{(x_i,y_i)\}_{i=1}^{n}$, mô hình học hàm
$\hat y_i=f(x_i)$ và tối ưu sai số trên biến liên tục phút kỹ thuật.
Đây không phải classification; không dùng accuracy, F1, ROC-AUC.
"""),
    md(r"""
## 3. Target formula

$$y=\frac{1}{60}\sum_{k:s_k\in\{INSPECTING,REPAIRING\}}
\max(0,\min(e_k,a_e)-\max(b_k,a_s))_{seconds}.$$

Mỗi active status interval $[b_k,e_k)$ được giao với assignment $[a_s,a_e)$.
Queue, chờ duyệt, chờ linh kiện, break, transfer gap và chờ bàn giao bị loại.
Production duration hiện chưa tự trừ service interruptions; V3 giữ đúng giới hạn đó.
"""),
    md("""
## 4. Prediction timestamp

Prediction timestamp là thời điểm assignment duy nhất sau khi phương án một
hạng mục APPROVED đã biết. Mọi feature phải tồn tại tại hoặc trước mốc này.
"""),
    md("""
## 5. Sample grain

Một ticket hoàn tất, đúng một approved repair item, một concrete catalog item,
một ended assignment, không accepted transfer, ordered history đầy đủ và target
dương. Không phân bổ giả duration của ticket nhiều item.
"""),
    md("""
## 6. Warranty context khác technical action

V3 dùng technical_action chỉ REPAIR hoặc REPLACEMENT. is_warranty là cờ ngữ
cảnh. Production derive cờ này từ warranty_source_item_id và resolve action từ
warranty_remedy hoặc catalog kỹ thuật thực thi. Legacy service type WARRANTY
không được coi là action thứ ba trong ML.
"""),
    md("""
## 7. Feature contract V3

20 feature gồm 9 categorical và 11 numeric. History có ba tầng: toàn bộ KTV,
KTV×issue và KTV×exact catalog. Count cold start bằng 0; average/efficiency giữ
NaN, không bịa thành standard hoặc 1.0.
"""),
    md("""
## 8. Leakage rules

Điều kiện duy nhất để một job cũ vào history:
previous_job.completed_at < current_prediction_timestamp.
Job bắt đầu trước nhưng hoàn tất sau bị loại. Preprocessing được fit trong từng
temporal fold; không backfill từ tương lai.
"""),
    md("""
## 9. Synthetic limitations

Catalog, KTV và target đều là dữ liệu tổng hợp có kiểm soát. Hidden capability,
specialty, complexity, noise và outlier không xuất ra. is_warranty không có
hidden duration multiplier. Metric synthetic không phải độ chính xác thực tế.
"""),
    md("## 10. Dataset validation"),
    code("""
%matplotlib inline
from pathlib import Path
import platform, sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import sklearn, xgboost, catboost

ML_ROOT = Path('ml') if Path('ml').exists() else Path.cwd()
sys.path.insert(0, str((ML_ROOT / 'src').resolve()))
from repair_duration_ml_v3.config import *
from repair_duration_ml_v3.data import load_dataset, temporal_holdout_split, feature_target
from repair_duration_ml_v3.training import run_competition

frame = load_dataset(ML_ROOT / 'data' / 'synthetic_repair_duration_v3.csv')
{
    'versions': {
        'python': platform.python_version(), 'sklearn': sklearn.__version__,
        'xgboost': xgboost.__version__, 'catboost': catboost.__version__,
    },
    'seed': SEED, 'shape': frame.shape,
    'duplicates': int(frame.duplicated().sum()),
    'missing': frame.isna().sum()[frame.isna().sum().gt(0)].to_dict(),
    'actions': frame.technical_action.value_counts().to_dict(),
    'warranty': frame.is_warranty.value_counts().to_dict(),
}
"""),
    md("## 11. Temporal split"),
    code("""
split = temporal_holdout_split(frame)
X_dev, y_dev = feature_target(split.development)
X_test, y_test = feature_target(split.test)
{
    'development': [len(X_dev), split.development.prediction_timestamp.min(),
                    split.development.prediction_timestamp.max()],
    'holdout': [len(X_test), split.test.prediction_timestamp.min(),
                split.test.prediction_timestamp.max()],
}
"""),
    md("## 12. Train-only EDA"),
    code("""
eda = split.development
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
axes[0].hist(eda[TARGET], bins=40, color='#2563eb', alpha=.82)
axes[0].set(title='Development target', xlabel='Technical minutes')
eda.groupby('technical_action', observed=True)[TARGET].mean().plot.bar(ax=axes[1])
axes[1].set(title='Development mean by action', ylabel='Minutes')
plt.tight_layout(); plt.show()
eda[TARGET].describe(percentiles=[.5,.9,.95]).round(2)
"""),
    md(r"""
## 13. Baselines

Mean baseline dự đoán $\bar y_{train}$ trong mỗi fold.
StandardDurationBaseline dự đoán
$\hat y_i=standard\_duration\_minutes_i$ và là business baseline chính.
"""),
    md(r"""
## 14. Metric formulas

$$MAE=\frac1n\sum|y_i-\hat y_i|,\quad
MSE=\frac1n\sum(y_i-\hat y_i)^2,\quad RMSE=\sqrt{MSE}.$$
$$R^2=1-\frac{\sum(y_i-\hat y_i)^2}{\sum(y_i-\bar y)^2}.$$
$P90AE=Q_{0.90}(|y-\hat y|)$.
Within-$t=100\,n^{-1}\sum\mathbf1(|y_i-\hat y_i|\le t)$ với
$t\in\{15,30,45\}$ phút. Đây là tolerance, không phải classification accuracy.
"""),
    md(r"""
## 15. Random Forest theory

$$\hat y_{RF}(x)=\frac1B\sum_{b=1}^{B}T_b(x).$$
Bootstrap, random feature subsets và averaging giảm variance; mỗi regression
split giảm tổng squared error của hai nút con.
"""),
    md(r"""
## 16. HistGradientBoosting theory

$$F_m(x)=F_{m-1}(x)+\eta h_m(x).$$
Learner mới xấp xỉ negative gradient; histogram binning tăng hiệu quả tìm split.
Pipeline V3 dùng dense ordinal categories và native categorical splits.
"""),
    md(r"""
## 17. XGBoost theory

$$Obj^{(t)}\approx\sum_i[g_if_t(x_i)+\tfrac12h_if_t(x_i)^2]+\Omega(f_t),$$
$$g_i=\partial_{\hat y}l,\quad h_i=\partial_{\hat y}^2l,\quad
\Omega(f)=\gamma T+\tfrac12\lambda\|w\|^2.$$

V3 dùng objective reg:squarederror để gradient/Hessian bậc hai khớp công thức;
eval_metric và model selection vẫn là MAE.
"""),
    md(r"""
## 18. CatBoost theory

CatBoost xử lý category native và ordered target statistics. Minh họa:
$$TS_i=\frac{\sum_{\sigma(j)<\sigma(i)}1[x_j=x_i]y_j+aP}
{\sum_{\sigma(j)<\sigma(i)}1[x_j=x_i]+a}.$$
Permutation order giúp không dùng target hiện tại để encode chính nó. Đây là
trực giác rút gọn, không phải toàn bộ thuật toán.
"""),
    md("""
## 19. Hyperparameter tuning

Bốn candidate dùng cùng TimeSeriesSplit(4), RandomizedSearchCV fixed seed,
12 cấu hình/model và neg_mean_absolute_error. RF/HGB/XGB/CatBoost giữ
preprocessing phù hợp riêng; không StandardScaler không cần thiết.
"""),
    md("## 20. Temporal CV comparison"),
    code("""
result = run_competition(
    ML_ROOT / 'data' / 'synthetic_repair_duration_v3.csv',
    output_dir=None, cv_splits=4, test_fraction=.15,
    search_iterations=12, smoke=False,
)
cv_columns = [
    'model','cv_mae_mean','cv_mae_std','cv_mse','cv_rmse','cv_r2',
    'cv_p90_absolute_error','cv_within_15_percent',
    'cv_within_30_percent','cv_within_45_percent'
]
result.cv_table[cv_columns].round(3)
"""),
    md("## 21. Winner lock"),
    code("""
{'winner': result.winner_name, 'reason': result.winner_reason,
 'best_parameters': result.best_parameters[result.winner_name]}
"""),
    md("""
## 22. Final holdout

Holdout 15% cuối chỉ được đánh giá bên trong reusable core sau khi winner đã
khóa bằng development CV. Bảng vẫn hiển thị mọi candidate để audit; không đổi
winner theo kết quả holdout.
"""),
    code("""
test_columns = [
    'model','mae','mse','rmse','r2','p90_absolute_error',
    'within_15_percent','within_30_percent','within_45_percent',
    'fit_seconds','predict_seconds'
]
result.test_table[test_columns].round(3)
"""),
    md("## 23. Residual diagnostics"),
    code("""
residual = y_test.to_numpy() - result.test_predictions
fig, axes = plt.subplots(1, 3, figsize=(15, 4))
axes[0].scatter(y_test, result.test_predictions, alpha=.35, s=14)
lo=min(y_test.min(),result.test_predictions.min()); hi=max(y_test.max(),result.test_predictions.max())
axes[0].plot([lo,hi],[lo,hi],'k--'); axes[0].set(title='Actual vs predicted')
axes[1].scatter(result.test_predictions,residual,alpha=.35,s=14)
axes[1].axhline(0,color='k',ls='--'); axes[1].set(title='Residual vs predicted')
axes[2].hist(residual,bins=35); axes[2].set(title='Residual distribution')
plt.tight_layout(); plt.show()
pd.Series(residual).describe().round(3)
"""),
    md("## 24. Tolerance metrics"),
    code("""
winner_test = result.test_table[result.test_table.model.eq(result.winner_name)].iloc[0]
winner_test[['p90_absolute_error','within_15_percent',
             'within_30_percent','within_45_percent']].round(3)
"""),
    md("## 25. Subgroup analysis"),
    code("""
{name: pd.DataFrame(rows) for name, rows in result.subgroup_metrics.items()}
"""),
    md("""
## 26. Feature importance

Permutation importance đo MAE tăng khi xáo trộn một feature trên holdout.
Đây là giá trị dự báo đối với model, không chứng minh quan hệ nhân quả.
"""),
    code("""
pd.DataFrame(result.feature_importances).head(20).round(4)
"""),
    md("## 27. Cold start"),
    code("""
pd.Series(result.cold_start_predictions, name='predicted_technical_minutes')
"""),
    md("## 28. New-job prediction example"),
    code("""
from repair_duration_ml_v3.evaluation import cold_start_examples
example = cold_start_examples(X_dev).loc[['new_technician']]
{'features': example.to_dict(orient='records')[0],
 'prediction': float(result.winner_estimator.predict(example)[0])}
"""),
    md("""
## 29. Predicted duration và ETA

Predicted technical minutes chỉ mô tả active work. ETA tương lai phải kết hợp
queue, working schedule, configured break, current ticket state và operational
timing rules. Model không tự assign KTV và chưa được Spring Boot gọi.
"""),
    md("""
## 30. Limitations

- synthetic data không xác nhận real-world generalization;
- multi-item, transfer và incomplete history bị loại;
- production interruption chưa bị duration service trừ;
- subgroup nhỏ phải đọc cùng sample count;
- permutation importance không phải causality;
- không có drift/backtest trên dữ liệu thật.
"""),
    md("""
## 31. Next real-data phase

MySQL consistent snapshot → leakage-safe extractor → cùng V3 feature contract →
real temporal validation → explicit model approval → mới cân nhắc runtime/ETA
integration. Không có satisfaction classifier hoặc automatic retraining.
"""),
]

notebook = nbf.v4.new_notebook(
    cells=cells,
    metadata={
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3",
        },
        "language_info": {"name": "python", "version": "3.13"},
    },
)
nbf.write(notebook, OUTPUT)
print(f"Wrote {len(cells)} cells to {OUTPUT}")
