"""Lớp bọc CatBoost để dùng được với sklearn.clone() / GridSearchCV / Pipeline.

Vấn đề: CatBoostRegressor sao chép danh sách `cat_features` trong __init__ nên sklearn.clone() báo
"constructor either does not set or modifies parameter cat_features". Cách sửa: định nghĩa __sklearn_clone__
(sklearn >= 1.3 ưu tiên dùng hàm này), dựng bản sao mới từ get_params().
Lớp nằm ở cấp module (không phải trong hàm) để joblib lưu/nạp bundle được."""
try:
    from catboost import CatBoostRegressor

    class CatBoostSK(CatBoostRegressor):
        def __sklearn_clone__(self):
            params = {k: (list(v) if isinstance(v, (list, tuple)) else v) for k, v in self.get_params().items()}
            return type(self)(**params)
except ImportError:          # chưa cài catboost: cuộc thi chạy không có CatBoost
    CatBoostSK = None
