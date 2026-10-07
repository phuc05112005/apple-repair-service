"""Build the single final repair-duration notebook from auditable source cells."""

from __future__ import annotations

from pathlib import Path

import nbformat as nbf

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "repair_duration_regression.ipynb"


def md(value: str):
    return nbf.v4.new_markdown_cell(value.strip())


def code(value: str):
    return nbf.v4.new_code_cell(value.strip())


cells = [
    md("""
# Dự đoán thời lượng kỹ thuật sửa chữa thiết bị Apple

**Trạng thái: EXPERIMENTAL_DEMO — chỉ dùng dữ liệu tổng hợp — chưa kiểm chứng sản xuất — chưa tích hợp runtime.**

Notebook này là luồng final duy nhất: dữ liệu → EDA → bằng chứng feature → tiền xử lý →
chia thời gian → baseline → Random Forest / XGBoost / CatBoost → tuning → temporal CV →
khóa winner → final holdout → diagnostics → artifact → inference mẫu.
"""),
    md(r"""
## 1. Bài toán hồi quy và target

Với $D=\{(x_i,y_i)\}_{i=1}^{n}$, mô hình học $\hat y_i=f(x_i)$ cho biến liên tục
`actual_technical_minutes`. Đây không phải ETA và không phải phân loại.

$$y=\frac{1}{60}\sum_{k:s_k\in\{INSPECTING,REPAIRING\}}
\max(0,\min(e_k,a_e)-\max(b_k,a_s))_{seconds}.$$

Mỗi khoảng trạng thái kỹ thuật $[b_k,e_k)$ được giao với assignment duy nhất
$[a_s,a_e)$. Queue, chờ duyệt, chờ linh kiện, break, transfer gap và chờ bàn giao bị loại.
"""),
    md("""
## 2. Sample grain, thời điểm dự đoán và bảo hành

Một mẫu là ticket hoàn tất có đúng một RepairItem APPROVED, một catalog cụ thể,
một assignment đã kết thúc, không transfer được chấp nhận, history đầy đủ và target dương.
Prediction timestamp là lúc assignment đầu tiên bắt đầu sau khi phương án đã biết.

`technical_action` chỉ có REPAIR/REPLACEMENT. `is_warranty` là ngữ cảnh nhị phân;
không có action WARRANTY và không có hệ số thời lượng bảo hành ẩn.
"""),
    code("""
%matplotlib inline
from pathlib import Path
import json, platform, sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import sklearn, xgboost, catboost

ML_ROOT = Path('ml') if Path('ml').exists() else Path.cwd()
sys.path.insert(0, str((ML_ROOT / 'src').resolve()))
from repair_duration_ml.config import *
from repair_duration_ml.data import load_dataset, temporal_holdout_split, feature_target
from repair_duration_ml.evaluation import cold_start_examples, development_numeric_correlations
from repair_duration_ml.features import FEATURE_ABLATION_STAGES, FEATURE_EVIDENCE
from repair_duration_ml.models import build_model_specs
from repair_duration_ml.training import run_competition, sha256_file

DATA_PATH = ML_ROOT / 'data' / 'synthetic_repair_duration.csv'
ARTIFACT_DIR = ML_ROOT / 'models' / 'experimental'
frame = load_dataset(DATA_PATH)
{
    'versions': {'python': platform.python_version(), 'sklearn': sklearn.__version__,
                 'xgboost': xgboost.__version__, 'catboost': catboost.__version__},
    'seed': SEED, 'sha256': sha256_file(DATA_PATH), 'shape': frame.shape,
    'duplicates': int(frame.duplicated().sum()),
    'missing': frame.isna().sum()[frame.isna().sum().gt(0)].to_dict(),
}
"""),
    md("""
## 3. Data dictionary và kiểm tra quan hệ

Các trường lịch sử đều kết thúc bằng `_before` để thể hiện đúng thời điểm. Count = 0
khi chưa có lịch sử; average/efficiency = NaN. Danh mục tổng hợp chỉ sinh các tổ hợp
device type, model, issue, action và catalog đã khai báo; latent capability, specialty,
complexity, noise và outlier không được xuất thành feature.
"""),
    code("""
data_dictionary = pd.DataFrame([
    {'feature': c, 'type': 'numeric' if c in NUMERIC_FEATURES else 'categorical',
     'available_at_prediction': True, 'leakage_safe': True}
    for c in FINAL_FEATURE_COLUMNS
])
display(data_dictionary)
display(frame.head(3))
display(frame.dtypes.rename('dtype').to_frame())
display(frame[TARGET].describe(percentiles=[.5,.9,.95]).round(3))
"""),
    md("""
## 4. Chia thời gian trước mọi phân tích có target

85% đầu là development; 15% cuối là holdout nguyên vẹn. Correlation, EDA, ablation,
tuning và chọn winner chỉ dùng development. Holdout không được dùng để sửa feature,
hyperparameter hay đổi winner.
"""),
    code("""
split = temporal_holdout_split(frame)
X_dev, y_dev = feature_target(split.development)
X_test, y_test = feature_target(split.test)
pd.DataFrame([
    {'partition':'development','rows':len(split.development),
     'start':split.development[TIME_COLUMN].min(),'end':split.development[TIME_COLUMN].max()},
    {'partition':'untouched_holdout','rows':len(split.test),
     'start':split.test[TIME_COLUMN].min(),'end':split.test[TIME_COLUMN].max()},
])
"""),
    md("## 5. EDA chỉ trên development"),
    code("""
eda = split.development
fig, axes = plt.subplots(1, 3, figsize=(16, 4))
axes[0].hist(eda[TARGET], bins=40, color='#2563eb', alpha=.82)
axes[0].set(title='Phân phối target — development', xlabel='Phút kỹ thuật')
eda.groupby('technical_action', observed=True)[TARGET].mean().plot.bar(ax=axes[1], color='#0f766e')
axes[1].set(title='Trung bình theo thao tác', ylabel='Phút')
eda.groupby('device_type', observed=True)[TARGET].median().sort_values().plot.barh(ax=axes[2], color='#9333ea')
axes[2].set(title='Trung vị theo loại thiết bị', xlabel='Phút')
plt.tight_layout(); plt.show()
"""),
    md(r"""
## 6. Bằng chứng correlation

Pearson $r_{XY}=\frac{\operatorname{cov}(X,Y)}{\sigma_X\sigma_Y}$ chỉ mô tả liên hệ
tuyến tính giữa các biến số trên development. Correlation không tự động quyết định giữ/bỏ
feature và không phải lý do biến category thành số nguyên tùy ý.
"""),
    code("""
corr_matrix, target_corr = development_numeric_correlations(split.development)
display(target_corr.rename('correlation_with_target').to_frame())
fig, ax = plt.subplots(figsize=(11, 9))
image = ax.imshow(corr_matrix, cmap='coolwarm', vmin=-1, vmax=1)
ax.set_xticks(range(len(corr_matrix)), corr_matrix.columns, rotation=90, fontsize=8)
ax.set_yticks(range(len(corr_matrix)), corr_matrix.index, fontsize=8)
fig.colorbar(image, ax=ax); ax.set_title('Development-only numeric correlation')
plt.tight_layout(); plt.show()
"""),
    md("""
## 7. Bốn tầng bằng chứng feature

Mỗi nhóm phải có ý nghĩa nghiệp vụ, tồn tại tại prediction time, an toàn leakage và có
đóng góp dự báo trên development. Ablation dùng một XGBoost bảo thủ cố định và cùng bốn
fold; không tune theo holdout.
"""),
    code("""
pd.DataFrame(FEATURE_EVIDENCE).T
"""),
    md(r"""
## 8. Tiền xử lý và missing value

- RF/XGB: median numeric được học riêng trong training fold; category dùng one-hot và
  `handle_unknown='ignore'`.
- CatBoost: category native và numeric NaN native.
- Không fit imputer/encoder trên toàn bộ dữ liệu; không dùng StandardScaler vì mô hình cây.

Median trong fold là $\tilde x_j=\operatorname{median}\{x_{ij}:i\in train\}$.
"""),
    md(r"""
## 9. Baseline và metric

Mean baseline: $\hat y=\bar y_{train}$ trong từng fold. Business baseline:
$\hat y=standard\_duration\_minutes$.

$$MAE=\frac1n\sum|y_i-\hat y_i|,\quad MSE=\frac1n\sum(y_i-\hat y_i)^2,$$
$$RMSE=\sqrt{MSE},\quad R^2=1-\frac{\sum(y_i-\hat y_i)^2}{\sum(y_i-\bar y)^2}.$$

$P90AE=Q_{0.90}(|y-\hat y|)$ và
$Within_t=100n^{-1}\sum\mathbf1(|y_i-\hat y_i|\le t)$ với $t\in\{15,30,45\}$.
R² không phải accuracy.
"""),
    md(r"""
## 10. Random Forest Regressor

$$\hat y_{RF}(x)=\frac1B\sum_{b=1}^{B}T_b(x).$$

Bootstrap, lấy mẫu feature ngẫu nhiên và trung bình nhiều cây giúp giảm variance. Search:
`n_estimators`, `max_depth`, `min_samples_split`, `min_samples_leaf`, `max_features`.
"""),
    md(r"""
## 11. XGBoost Regressor

$$Obj^{(t)}\approx\sum_i[g_if_t(x_i)+\tfrac12h_if_t(x_i)^2]+\Omega(f_t),$$
$$g_i=\partial_{\hat y}l,\ h_i=\partial^2_{\hat y}l,\
\Omega(f)=\gamma T+\tfrac12\lambda\lVert w\rVert^2.$$

Objective là `reg:squarederror` để có gradient/Hessian bậc hai; đánh giá và chọn model
vẫn theo MAE. Search learning rate, depth, child weight, sampling và regularization.
"""),
    md(r"""
## 12. CatBoost Regressor

CatBoost xử lý category native bằng ordered statistics. Trực giác rút gọn:
$$TS_i=\frac{\sum_{\sigma(j)<\sigma(i)}1[x_j=x_i]y_j+aP}
{\sum_{\sigma(j)<\sigma(i)}1[x_j=x_i]+a}.$$

Thứ tự permutation tránh dùng target của chính hàng đang encode. Loss train là RMSE,
eval/model selection là MAE. Search iterations, learning rate, depth, L2 và random strength.
"""),
    md("""
## 13. Full temporal experiment

Ba candidate dùng đúng cùng `TimeSeriesSplit(4)`, 12 cấu hình ngẫu nhiên có seed cố định
cho mỗi model và scoring `neg_mean_absolute_error`. Cell này thực thi toàn bộ ablation,
tuning, CV, khóa winner rồi mới đánh giá holdout.
"""),
    code("""
result = run_competition(
    DATA_PATH, output_dir=None, cv_splits=4, test_fraction=.15,
    search_iterations=12, smoke=False,
)
result.feature_ablation.round(4)
"""),
    md("## 14. Feature freeze sau ablation"),
    code("""
display(result.feature_ablation.round(4))
print('FINAL_FEATURE_COLUMNS =')
print(FINAL_FEATURE_COLUMNS)
"""),
    md("## 15. Search spaces và best hyperparameters"),
    code("""
display(pd.DataFrame([
    {'model': name, 'search_space': result.search_spaces[name],
     'best_parameters': result.best_parameters[name],
     'preprocessing': result.preprocessing[name]}
    for name in MODEL_NAMES
]))
"""),
    md("## 16. Development temporal-CV và khóa winner"),
    code("""
cv_columns = ['model','cv_mae_mean','cv_mae_std','cv_mse','cv_rmse','cv_r2',
              'cv_p90_absolute_error','cv_within_15_percent',
              'cv_within_30_percent','cv_within_45_percent','search_seconds']
display(result.cv_table[cv_columns].round(3))
{'locked_winner': result.winner_name, 'reason': result.winner_reason}
"""),
    md("""
## 17. Final holdout

Winner đã khóa bằng CV trước cell này. Bảng có cả ba model để audit, nhưng không model nào
được đổi theo test. Đây là lần đọc final holdout duy nhất trong pipeline.
"""),
    code("""
test_columns = ['model','mae','mse','rmse','r2','p90_absolute_error',
                'within_15_percent','within_30_percent','within_45_percent',
                'fit_seconds','predict_seconds']
result.test_table[test_columns].round(3)
"""),
    md("## 18. Residual diagnostics"),
    code("""
residual = y_test.to_numpy() - result.test_predictions
absolute_error = np.abs(residual)
fig, axes = plt.subplots(2, 2, figsize=(12, 9))
axes[0,0].scatter(y_test, result.test_predictions, alpha=.35, s=14)
lo=min(y_test.min(),result.test_predictions.min()); hi=max(y_test.max(),result.test_predictions.max())
axes[0,0].plot([lo,hi],[lo,hi],'k--'); axes[0,0].set(title='Actual vs predicted')
axes[0,1].scatter(result.test_predictions,residual,alpha=.35,s=14)
axes[0,1].axhline(0,color='k',ls='--'); axes[0,1].set(title='Residual vs predicted')
axes[1,0].hist(residual,bins=35); axes[1,0].set(title='Residual distribution')
axes[1,1].hist(absolute_error,bins=35); axes[1,1].axvline(np.percentile(absolute_error,90),color='red',ls='--')
axes[1,1].set(title='Absolute error with P90')
plt.tight_layout(); plt.show()
pd.Series(residual).describe().round(3)
"""),
    md("""
## 19. Permutation importance — diễn giải final

Giá trị là mức MAE tăng khi hoán vị một feature. Đây là association với dự báo, không phải
quan hệ nhân quả. Vì được tính trên holdout, bảng chỉ diễn giải winner; không quay lại bỏ
feature hoặc đổi model.
"""),
    code("pd.DataFrame(result.feature_importances).round(4)"),
    md("## 20. Sai số theo subgroup"),
    code("""
for group_name, rows in result.subgroup_metrics.items():
    print()
    print(group_name)
    display(pd.DataFrame(rows).round(3))
"""),
    md("## 21. Năm tình huống cold-start"),
    code("pd.Series(result.cold_start_predictions, name='predicted_technical_minutes')"),
    md("## 22. Artifact đã lưu và inference mẫu"),
    code("""
metadata = json.loads((ARTIFACT_DIR / 'metadata.json').read_text(encoding='utf-8'))
assert metadata['model_status'] == 'EXPERIMENTAL_DEMO'
assert metadata['synthetic_data'] and not metadata['production_validated'] and not metadata['runtime_integrated']
if metadata['model_file'].endswith('.cbm'):
    from catboost import CatBoostRegressor
    reloaded = CatBoostRegressor()
    reloaded.load_model(ARTIFACT_DIR / metadata['model_file'])
else:
    import joblib
    reloaded = joblib.load(ARTIFACT_DIR / metadata['model_file'])
example = cold_start_examples(X_dev).loc[['new_technician']]
{'model': metadata['winner_name'],
 'prediction_minutes': float(reloaded.predict(example)[0]),
 'finite': bool(np.isfinite(reloaded.predict(example)[0]))}
"""),
    md("""
## 23. Kết luận và giới hạn

- Kết quả chỉ chứng minh pipeline trên dữ liệu tổng hợp, không chứng minh chất lượng thực tế.
- Multi-item, transfer và history thiếu bị loại; production interruptions chưa được trừ.
- Subgroup nhỏ phải đọc cùng sample count; importance không phải causality.
- Không có classifier hài lòng, API inference, Spring/ETA/UI, ghi DB hay deployment.

**Các bước kế tiếp, chưa triển khai:** MySQL real extractor → runtime feature builder →
inference API → Spring Boot integration → `ml_predictions` → ETA → React UI → E2E test →
Docker/deployment.
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
