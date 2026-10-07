from __future__ import annotations

import json
import math
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from repair_duration_data.catalog import internal_catalog_identity, normalize_catalog_service_label
from repair_duration_data.eligibility import EligibleSample
from repair_duration_data.feature_builder import build_base_feature_row
from repair_duration_ml.config import FEATURE_COLUMNS, OUTPUT_COLUMNS
from repair_duration_ml.features import attach_historical_features
from repair_duration_runtime.errors import RuntimeInferenceError
from repair_duration_runtime.feature_service import RuntimeFeatureService
from repair_duration_runtime.model_loader import ExperimentalModelLoader
from repair_duration_runtime.predictor import RepairDurationPredictor
from repair_duration_runtime.schemas import PredictionContext
from repair_duration_runtime.service import RepairDurationInferenceService
from repair_duration_runtime.vocabulary import TrainingVocabulary
from runtime_api.app import create_app

ML_ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ML_ROOT / "models" / "experimental"
AT = datetime(2026, 10, 6, 10, 0, tzinfo=timezone(timedelta(hours=7)))


def context(name: str = "Thay pin iPhone 14", catalog_id: int = 15) -> PredictionContext:
    return PredictionContext(91, "iPhone", "iPhone 14", "Pin", "REPLACEMENT", 0,
                             catalog_id, name, 60, 2)


def history(*, catalog_id: int = 15, name: str = "Tên cũ", completed=AT - timedelta(minutes=1), technician=7) -> dict:
    return {
        "completed_at": completed, "technician_id": f"TECH_{technician:02d}",
        "service_issue": "Pin", "catalog_service": name, "internal_catalog_id": catalog_id,
        "standard_duration_minutes": 60, "actual_technical_minutes": 75,
    }


class FakeRepository:
    def __init__(self, ctx=None, histories=None, ping=True):
        self.ctx = ctx or context()
        self.histories = histories or []
        self.ping_value = ping
        self.calls = []

    def load_context(self, ticket_id):
        self.calls.append(("context", ticket_id))
        return self.ctx

    def validate_candidates(self, technician_ids):
        self.calls.append(("candidates", tuple(technician_ids)))

    def load_history(self):
        self.calls.append(("history",))
        return self.histories

    def ping(self):
        return self.ping_value


class ErrorRepository(FakeRepository):
    def __init__(self, error):
        super().__init__()
        self.error = error
    def load_context(self, _ticket_id):
        raise self.error


@pytest.fixture(scope="module")
def loader():
    return ExperimentalModelLoader(ARTIFACTS).load()


def test_catalog_normalizer_preserves_training_representation():
    raw = "  Thay pin iPhone 16 Pro — Pisen  Dung lượng cao!  "
    assert normalize_catalog_service_label(raw) == "Thay pin iPhone 16 Pro — Pisen  Dung lượng cao!"


def test_catalog_normalizer_rejects_blank_and_non_string():
    with pytest.raises(ValueError): normalize_catalog_service_label("   ")
    with pytest.raises(ValueError): normalize_catalog_service_label(15)


def test_internal_identity_is_positive_integer():
    assert internal_catalog_identity("15") == 15
    with pytest.raises(ValueError): internal_catalog_identity(0)


def test_runtime_uses_name_for_model_feature_and_id_for_history():
    frame = RuntimeFeatureService().build(context("Tên mới", 15), [7], AT, [history(catalog_id=15, name="Tên cũ")])
    assert frame.loc[0, "catalog_service"] == "Tên mới"
    assert frame.loc[0, "technician_catalog_jobs_before"] == 1
    assert not frame.loc[0, "catalog_service"].startswith("CATALOG_")


def test_offline_runtime_model_label_and_internal_identity_parity():
    sample = EligibleSample(
        {"ticket_id": 91, "actual_repair_completed_at": AT + timedelta(hours=1),
         "device_type": "iPhone", "device_model": "iPhone 14", "branch_id": 2},
        {"service_issue": "Pin", "warranty_source_item_id": None},
        {"assigned_at": AT, "technician_id": 7},
        "REPLACEMENT", 15, "Thay pin iPhone 14", 60, 75,
    )
    offline = build_base_feature_row(sample)
    runtime = RuntimeFeatureService().build(context(), [7], AT, []).iloc[0]
    direct = ["device_type", "device_model", "service_issue", "technical_action", "is_warranty",
              "catalog_service", "standard_duration_minutes", "technician_id", "branch_id",
              "prediction_month", "prediction_weekday"]
    assert {key: offline[key] for key in direct} == {key: runtime[key] for key in direct}
    assert offline["internal_catalog_id"] == context().catalog_id == 15


def test_rename_does_not_reset_exact_catalog_history():
    frame = RuntimeFeatureService().build(context("Tên sau đổi", 15), [7], AT, [history(catalog_id=15, name="Tên trước đổi")])
    assert frame.loc[0, "technician_catalog_average_duration_before"] == 75


def test_two_catalog_ids_remain_distinct():
    frame = RuntimeFeatureService().build(context("B", 16), [7], AT, [history(catalog_id=15, name="A")])
    assert frame.loc[0, "technician_jobs_completed_before"] == 1
    assert frame.loc[0, "technician_catalog_jobs_before"] == 0


def test_duplicate_names_do_not_merge_catalog_history():
    frame = RuntimeFeatureService().build(context("Cùng tên", 16), [7], AT, [history(catalog_id=15, name="Cùng tên")])
    assert frame.loc[0, "technician_catalog_jobs_before"] == 0


def test_strict_history_boundary_excludes_equal_and_future():
    rows = [history(completed=AT), history(completed=AT + timedelta(seconds=1))]
    frame = RuntimeFeatureService().build(context(), [7], AT, rows)
    assert frame.loc[0, "technician_jobs_completed_before"] == 0


def test_all_candidates_share_exact_feature_timestamp_context():
    frame = RuntimeFeatureService().build(context(), [7, 8, 9], AT, [])
    assert list(frame["prediction_month"]) == ["M10"] * 3
    assert list(frame["prediction_weekday"]) == ["TUE"] * 3


def test_runtime_frame_is_exact_frozen_twenty_features():
    frame = RuntimeFeatureService().build(context(), [7], AT, [])
    assert frame.shape == (1, 20)
    assert list(frame.columns) == FEATURE_COLUMNS


def test_training_vocabulary_seen_and_unseen():
    vocab = TrainingVocabulary(ARTIFACTS / "category_vocabulary.json")
    assert len(vocab.catalog_services) == 37
    assert vocab.contains_catalog("Thay pin iPhone 14")
    assert not vocab.contains_catalog("Danh mục canonical chưa từng huấn luyện")


def test_model_loads_once(loader):
    assert loader.load().load() is loader
    assert loader.load_count == 1
    assert loader.info()["featureCount"] == 20
    assert loader.info()["runtimeVersions"]["catboost"]


@pytest.mark.parametrize("mutation", ["missing", "order", "metadata", "corrupt"])
def test_model_loader_rejects_invalid_artifacts(tmp_path, mutation):
    target = tmp_path / "artifacts"
    shutil.copytree(ARTIFACTS, target)
    if mutation == "missing":
        (target / "model.cbm").unlink()
    elif mutation == "order":
        payload = json.loads((target / "feature_contract.json").read_text(encoding="utf-8"))
        payload["features_in_order"] = list(reversed(payload["features_in_order"]))
        (target / "feature_contract.json").write_text(json.dumps(payload), encoding="utf-8")
    elif mutation == "metadata":
        payload = json.loads((target / "metadata.json").read_text(encoding="utf-8"))
        payload["production_validated"] = True
        (target / "metadata.json").write_text(json.dumps(payload), encoding="utf-8")
    else:
        (target / "model.cbm").write_bytes(b"not-a-model")
    with pytest.raises(RuntimeInferenceError) as caught:
        ExperimentalModelLoader(target).load()
    assert caught.value.code == "MODEL_LOAD_FAILED"


def test_versioned_contract_records_separate_catalog_semantics(loader):
    assert loader.contract["contract_version"] == "repair-duration-features-v1.1"
    assert "display-name" in loader.contract["catalog_service_semantics"]
    assert "service_catalog_items.id" in loader.contract["internal_catalog_identity"]


def test_frozen_model_predicts_finite_positive_seen_category(loader):
    frame = RuntimeFeatureService().build(context(), [7], AT, [])
    result = RepairDurationPredictor(loader).predict(frame, [7])[0]
    assert math.isfinite(result.predicted_technical_minutes) and result.predicted_technical_minutes > 0
    assert "UNSEEN_CATALOG_CATEGORY" not in result.warnings


def test_unseen_category_predicts_and_warns(loader):
    frame = RuntimeFeatureService().build(context("Danh mục canonical chưa từng huấn luyện"), [7], AT, [])
    result = RepairDurationPredictor(loader).predict(frame, [7])[0]
    assert math.isfinite(result.predicted_technical_minutes)
    assert "UNSEEN_CATALOG_CATEGORY" in result.warnings


@pytest.mark.parametrize("is_warranty,action", [(1, "REPAIR"), (1, "REPLACEMENT")])
def test_warranty_runtime_variants_are_finite(loader, is_warranty, action):
    source = context()
    warranty = PredictionContext(source.ticket_id, source.device_type, source.device_model,
        source.service_issue, action, is_warranty, source.catalog_id, source.catalog_service,
        source.standard_duration_minutes, source.branch_id)
    frame = RuntimeFeatureService().build(warranty, [7], AT, [])
    assert math.isfinite(RepairDurationPredictor(loader).predict(frame, [7])[0].predicted_technical_minutes)


def test_no_issue_or_catalog_history_prediction_is_finite(loader):
    frame = RuntimeFeatureService().build(context(), [7], AT, [history(catalog_id=99, name="Khác") | {"service_issue": "Màn hình"}])
    assert frame.loc[0, "technician_jobs_completed_before"] == 1
    assert frame.loc[0, "technician_issue_jobs_before"] == 0
    assert frame.loc[0, "technician_catalog_jobs_before"] == 0
    assert math.isfinite(RepairDurationPredictor(loader).predict(frame, [7])[0].predicted_technical_minutes)


def test_cold_start_warning(loader):
    frame = RuntimeFeatureService().build(context(), [99], AT, [])
    assert "COLD_START_TECHNICIAN" in RepairDurationPredictor(loader).predict(frame, [99])[0].warnings


def test_multi_candidate_preserves_input_order(loader):
    service = RepairDurationInferenceService(FakeRepository(), loader)
    result = service.predict_candidates(91, [9, 7, 8], AT)
    assert [row.technician_id for row in result.predictions] == [9, 7, 8]
    assert result.evaluation_timestamp.isoformat() == AT.isoformat()


def test_candidate_validation_rejects_empty_duplicates_and_naive_timestamp(loader):
    service = RepairDurationInferenceService(FakeRepository(), loader)
    with pytest.raises(RuntimeInferenceError): service.predict_candidates(91, [], AT)
    with pytest.raises(RuntimeInferenceError): service.predict_candidates(91, [7, 7], AT)
    with pytest.raises(RuntimeInferenceError): service.predict_candidates(91, [7], AT.replace(tzinfo=None))


def test_offline_and_runtime_history_formula_parity():
    offline = attach_historical_features([
        {**history(), "sample_id": "A", "prediction_timestamp": AT - timedelta(hours=2)},
        {**history(name="Tên cũ", completed=AT + timedelta(hours=1)), "sample_id": "B", "prediction_timestamp": AT,
         "catalog_service": "Tên mới"},
    ])
    runtime = RuntimeFeatureService().build(context("Tên mới", 15), [7], AT, [history()])
    columns = [name for name in FEATURE_COLUMNS if name.startswith("technician_") and name != "technician_id"]
    for column in columns:
        left, right = offline.iloc[1][column], runtime.iloc[0][column]
        assert (pd.isna(left) and pd.isna(right)) or left == pytest.approx(right)


def test_output_contract_has_no_pii():
    forbidden = {"customer_name", "customer_phone", "serial_number", "username", "email"}
    assert forbidden.isdisjoint(FEATURE_COLUMNS)
    assert forbidden.isdisjoint(OUTPUT_COLUMNS)


def test_api_live_ready_model_info_and_prediction(loader):
    app = create_app(FakeRepository(), ARTIFACTS)
    with TestClient(app) as client:
        assert client.get("/health/live").json() == {"status": "UP"}
        assert client.get("/health/ready").status_code == 200
        info = client.get("/api/v1/model-info").json()
        assert info["modelStatus"] == "EXPERIMENTAL_DEMO"
        response = client.post("/api/v1/repair-duration/predict-candidates", json={
            "ticketId": 91, "candidateTechnicianIds": [7, 8], "evaluationTimestamp": AT.isoformat()
        })
        assert response.status_code == 200
        body = response.json()
        assert [row["technicianId"] for row in body["predictions"]] == [7, 8]
        assert body["model"] == {"name": "CatBoostRegressor", "version": "repair-duration-final-synthetic-v1",
            "status": "EXPERIMENTAL_DEMO", "featureContractVersion": "repair-duration-features-v1.1",
            "syntheticData": True, "productionValidated": False}
        assert "eta" not in json.dumps(body).lower()
        assert "rank" not in json.dumps(body).lower()


def test_api_validation_is_sanitized():
    with TestClient(create_app(FakeRepository(), ARTIFACTS)) as client:
        response = client.post("/api/v1/repair-duration/predict-candidates", json={
            "ticketId": 91, "candidateTechnicianIds": [], "evaluationTimestamp": AT.isoformat(), "unexpected": "secret"
        })
        assert response.status_code == 422
        assert response.json() == {"error": {"code": "INVALID_REQUEST", "message": "Request body is invalid"}}


def test_api_readiness_reports_database_failure():
    with TestClient(create_app(FakeRepository(ping=False), ARTIFACTS)) as client:
        response = client.get("/health/ready")
        assert response.status_code == 503
        assert response.json()["checks"] == {"model": True, "database": False}


@pytest.mark.parametrize("payload", [
    {},
    {"ticketId": 0, "candidateTechnicianIds": [1], "evaluationTimestamp": AT.isoformat()},
    {"ticketId": 1, "candidateTechnicianIds": [], "evaluationTimestamp": AT.isoformat()},
    {"ticketId": 1, "candidateTechnicianIds": list(range(1, 52)), "evaluationTimestamp": AT.isoformat()},
    {"ticketId": 1, "candidateTechnicianIds": [1], "evaluationTimestamp": "not-a-date"},
])
def test_api_malformed_requests_return_sanitized_422(payload):
    with TestClient(create_app(FakeRepository(), ARTIFACTS)) as client:
        response = client.post("/api/v1/repair-duration/predict-candidates", json=payload)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "INVALID_REQUEST"


@pytest.mark.parametrize("code,status", [
    ("TICKET_NOT_FOUND", 404), ("TECHNICIAN_NOT_FOUND", 404),
    ("PLAN_NOT_READY", 409), ("MULTI_ITEM_NOT_SUPPORTED", 409),
    ("DATABASE_UNAVAILABLE", 503),
])
def test_api_propagates_stable_runtime_errors(code, status):
    repo = ErrorRepository(RuntimeInferenceError(code, "Safe message", status))
    with TestClient(create_app(repo, ARTIFACTS)) as client:
        response = client.post("/api/v1/repair-duration/predict-candidates", json={
            "ticketId": 91, "candidateTechnicianIds": [7], "evaluationTimestamp": AT.isoformat()})
        assert response.status_code == status
        assert response.json() == {"error": {"code": code, "message": "Safe message"}}
        assert "traceback" not in response.text.lower()


def test_api_model_unavailable_is_503(tmp_path):
    with TestClient(create_app(FakeRepository(), tmp_path)) as client:
        assert client.get("/health/live").status_code == 200
        assert client.get("/health/ready").status_code == 503
        response = client.get("/api/v1/model-info")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "MODEL_NOT_READY"


def test_api_unexpected_error_is_sanitized():
    repo = ErrorRepository(ValueError("private database detail"))
    with TestClient(create_app(repo, ARTIFACTS), raise_server_exceptions=False) as client:
        response = client.post("/api/v1/repair-duration/predict-candidates", json={
            "ticketId": 91, "candidateTechnicianIds": [7], "evaluationTimestamp": AT.isoformat()})
        assert response.status_code == 500
        assert response.json()["error"]["code"] == "INTERNAL_ERROR"
        assert "private database detail" not in response.text


def test_api_model_info_has_complete_non_sensitive_metadata():
    with TestClient(create_app(FakeRepository(), ARTIFACTS)) as client:
        body = client.get("/api/v1/model-info").json()
        assert body["modelName"] == "CatBoostRegressor"
        assert body["featureContractVersion"] == "repair-duration-features-v1.1"
        assert body["syntheticData"] is True and body["productionValidated"] is False
        assert set(body["runtimeVersions"]) == {"python", "catboost", "pandas", "numpy"}


def test_api_duplicate_candidates_are_rejected():
    with TestClient(create_app(FakeRepository(), ARTIFACTS)) as client:
        response = client.post("/api/v1/repair-duration/predict-candidates", json={
            "ticketId": 91, "candidateTechnicianIds": [7, 7], "evaluationTimestamp": AT.isoformat()})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "INVALID_CANDIDATES"


def test_api_naive_timestamp_is_rejected():
    with TestClient(create_app(FakeRepository(), ARTIFACTS)) as client:
        response = client.post("/api/v1/repair-duration/predict-candidates", json={
            "ticketId": 91, "candidateTechnicianIds": [7], "evaluationTimestamp": "2026-10-06T10:00:00"})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "INVALID_EVALUATION_TIMESTAMP"


def test_api_cold_start_warning_is_returned():
    with TestClient(create_app(FakeRepository(), ARTIFACTS)) as client:
        response = client.post("/api/v1/repair-duration/predict-candidates", json={
            "ticketId": 91, "candidateTechnicianIds": [7], "evaluationTimestamp": AT.isoformat()})
        assert "COLD_START_TECHNICIAN" in response.json()["predictions"][0]["warnings"]


def test_api_response_has_no_pii_or_raw_features():
    with TestClient(create_app(FakeRepository(), ARTIFACTS)) as client:
        text = client.post("/api/v1/repair-duration/predict-candidates", json={
            "ticketId": 91, "candidateTechnicianIds": [7], "evaluationTimestamp": AT.isoformat()}).text.lower()
        for forbidden in ("customer", "phone", "email", "serial", "imei", "catalog_service", "device_model"):
            assert forbidden not in text
