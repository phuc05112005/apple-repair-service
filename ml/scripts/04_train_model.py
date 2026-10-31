import sys
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

# Định tuyến sys.path để import cấu hình config
SCRIPT_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPT_DIR.parent
if str(ML_DIR) not in sys.path:
    sys.path.append(str(ML_DIR))

from config.config import (
    BEST_MODEL_PATH,
    PROCESSED_DATA_PATH,
    RANDOM_STATE,
    TARGET_COL,
    TEST_SIZE,
)


def main():
    print(f"1. Tải dữ liệu đã qua tiền xử lý từ: {PROCESSED_DATA_PATH}")
    df = pd.read_csv(PROCESSED_DATA_PATH)

    X = df.drop(columns=[TARGET_COL])
    y = df[TARGET_COL]

    # Chia tập Train (80%) / Test (20%)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )

    print(f"   + Tập Train: {X_train.shape[0]} mẫu | Số đặc trưng: {X_train.shape[1]}")
    print(f"   + Tập Test : {X_test.shape[0]} mẫu")

    # =========================================================================
    # 2. CHẠY MÔ HÌNH CATBOOST (SỬ DỤNG NATIVE GRID SEARCH CỦA CATBOOST)
    # =========================================================================
    print("\n2. Tiến hành Tinh chỉnh Siêu tham số (CatBoost Native Grid Search)...")

    cb_model = CatBoostRegressor(random_seed=RANDOM_STATE, verbose=0)

    param_grid_cb = {
        "iterations": [500, 1000],
        "learning_rate": [0.03, 0.05, 0.1],
        "depth": [4, 6, 8],
    }

    # Sử dụng phương thức grid_search nguyên bản của CatBoost
    grid_search_result = cb_model.grid_search(
        param_grid_cb,
        X=X_train,
        y=y_train,
        cv=5,
        partition_random_seed=RANDOM_STATE,
        verbose=False,
        plot=False,
    )

    # Đánh giá dự đoán trên tập Test
    preds = cb_model.predict(X_test)

    mae = mean_absolute_error(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    r2 = r2_score(y_test, preds)

    print("\n=== KẾT QUẢ ĐÁNH GIÁ MÔ HÌNH TỐT NHẤT ===")
    print(f"Mô hình     : CatBoost (Tuned)")
    print(f"Best Params : {grid_search_result['params']}")
    print(f"MAE         : {mae:.4f} phút")
    print(f"RMSE        : {rmse:.4f} phút")
    print(f"R2 Score    : {r2:.6f}")

    # =========================================================================
    # 3. LƯU MÔ HÌNH ĐÃ HUẤN LUYỆN
    # =========================================================================
    joblib.dump(cb_model, BEST_MODEL_PATH)
    print(f"\n--> [THÀNH CÔNG] Đã lưu mô hình CatBoost tốt nhất tại: {BEST_MODEL_PATH}")


if __name__ == "__main__":
    main()