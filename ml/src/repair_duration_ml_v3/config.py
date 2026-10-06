"""Immutable feature and experiment contract for repair-duration V3."""

from __future__ import annotations

SEED = 20261006
EXPERIMENT_VERSION = "V3"
TARGET = "actual_technical_minutes"
TIME_COLUMN = "prediction_timestamp"

NUMERIC_FEATURES = [
    "standard_duration_minutes",
    "is_warranty",
    "technician_jobs_completed_before",
    "technician_average_duration_before",
    "technician_historical_efficiency_before",
    "technician_issue_jobs_before",
    "technician_issue_average_duration_before",
    "technician_issue_efficiency_before",
    "technician_catalog_jobs_before",
    "technician_catalog_average_duration_before",
    "technician_catalog_efficiency_before",
]

CATEGORICAL_FEATURES = [
    "device_type",
    "device_model",
    "service_issue",
    "technical_action",
    "catalog_service",
    "technician_id",
    "branch_id",
    "prediction_month",
    "prediction_weekday",
]

FEATURE_COLUMNS = [
    "device_type",
    "device_model",
    "service_issue",
    "technical_action",
    "is_warranty",
    "catalog_service",
    "standard_duration_minutes",
    "technician_id",
    "branch_id",
    "prediction_month",
    "prediction_weekday",
    "technician_jobs_completed_before",
    "technician_average_duration_before",
    "technician_historical_efficiency_before",
    "technician_issue_jobs_before",
    "technician_issue_average_duration_before",
    "technician_issue_efficiency_before",
    "technician_catalog_jobs_before",
    "technician_catalog_average_duration_before",
    "technician_catalog_efficiency_before",
]

OUTPUT_COLUMNS = ["sample_id", TIME_COLUMN, "completed_at", *FEATURE_COLUMNS, TARGET]

INTENTIONAL_MISSING_COLUMNS = {
    "technician_average_duration_before",
    "technician_historical_efficiency_before",
    "technician_issue_average_duration_before",
    "technician_issue_efficiency_before",
    "technician_catalog_average_duration_before",
    "technician_catalog_efficiency_before",
}

FORBIDDEN_COLUMNS = {
    "service_type",
    "technician_speed_factor",
    "technician_capability_factor",
    "technician_specialty_factor",
    "case_complexity_factor",
    "complexity_factor",
    "outlier_factor",
    "feedback",
    "satisfaction",
    "customer_name",
    "customer_phone",
    "ticket_code",
    "serial_number",
    "eta_error",
    "predicted_duration",
}

MODEL_NAMES = (
    "RandomForestRegressor",
    "HistGradientBoostingRegressor",
    "XGBRegressor",
    "CatBoostRegressor",
)

NEAR_TIE_MINUTES = 0.25
CV_SPLITS = 4
TEST_FRACTION = 0.15
DEFAULT_SEARCH_ITERATIONS = 12
TOLERANCE_THRESHOLDS = (15, 30, 45)
