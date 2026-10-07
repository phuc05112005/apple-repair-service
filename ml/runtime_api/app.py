import logging
import sys
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

ML_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_ROOT / "src"))

from repair_duration_data.db import DatabaseConfig
from repair_duration_runtime.errors import RuntimeInferenceError
from repair_duration_runtime.model_loader import ExperimentalModelLoader
from repair_duration_runtime.repository import MySQLRuntimeRepository, RuntimeRepository
from repair_duration_runtime.service import RepairDurationInferenceService

LOGGER = logging.getLogger("repair_duration_runtime")


class PredictCandidatesRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=lambda value: value.split("_")[0] + "".join(part.title() for part in value.split("_")[1:]),
        populate_by_name=True,
    )
    ticket_id: int = Field(gt=0)
    candidate_technician_ids: list[int] = Field(min_length=1, max_length=50)
    evaluation_timestamp: datetime


def error_payload(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


class _UnavailableRepository:
    def load_context(self, _ticket_id):
        raise RuntimeInferenceError("DATABASE_NOT_READY", "Database configuration is unavailable", 503)
    def validate_candidates(self, _technician_ids):
        raise RuntimeInferenceError("DATABASE_NOT_READY", "Database configuration is unavailable", 503)
    def load_history(self):
        raise RuntimeInferenceError("DATABASE_NOT_READY", "Database configuration is unavailable", 503)
    def ping(self):
        return False


def create_app(repository: RuntimeRepository | None = None, artifact_dir: Path | None = None) -> FastAPI:
    loader = ExperimentalModelLoader(artifact_dir or ML_ROOT / "models" / "experimental")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.model_error = None
        try:
            loader.load()
        except RuntimeInferenceError as exc:
            app.state.model_error = exc
        effective_repository = repository
        if effective_repository is None:
            try:
                effective_repository = MySQLRuntimeRepository(DatabaseConfig.from_environment())
            except Exception:
                effective_repository = _UnavailableRepository()
        app.state.repository = effective_repository
        app.state.inference = None if app.state.model_error else RepairDurationInferenceService(effective_repository, loader)
        yield

    app = FastAPI(title="Apple Repair Duration Internal Runtime", version="1.0.0", lifespan=lifespan)

    @app.exception_handler(RuntimeInferenceError)
    async def runtime_error(_request: Request, exc: RuntimeInferenceError):
        return JSONResponse(status_code=exc.http_status, content=error_payload(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, _exc: RequestValidationError):
        return JSONResponse(status_code=422, content=error_payload("INVALID_REQUEST", "Request body is invalid"))

    @app.exception_handler(Exception)
    async def unexpected_error(_request: Request, exc: Exception):
        LOGGER.exception("Unexpected inference error: %s", type(exc).__name__)
        return JSONResponse(status_code=500, content=error_payload("INTERNAL_ERROR", "Inference service encountered an unexpected error"))

    @app.get("/health/live")
    def live():
        return {"status": "UP"}

    @app.get("/health/ready")
    def ready(request: Request):
        model_ready = request.app.state.model_error is None and loader.is_loaded
        database_ready = request.app.state.repository.ping()
        ok, checks = model_ready and database_ready, {"model": model_ready, "database": database_ready}
        return JSONResponse(status_code=200 if ok else 503,
            content={"status": "UP" if ok else "NOT_READY", "checks": checks})

    @app.get("/api/v1/model-info")
    def model_info():
        if not loader.is_loaded:
            raise RuntimeInferenceError("MODEL_NOT_READY", "Model artifacts are not ready", 503)
        return loader.info()

    @app.post("/api/v1/repair-duration/predict-candidates")
    def predict(body: PredictCandidatesRequest, request: Request):
        if request.app.state.inference is None:
            raise RuntimeInferenceError("MODEL_NOT_READY", "Model artifacts are not ready", 503)
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid4())
        started = perf_counter()
        try:
            batch = request.app.state.inference.predict_candidates(
                body.ticket_id, body.candidate_technician_ids, body.evaluation_timestamp
            )
        except RuntimeInferenceError as exc:
            LOGGER.warning("prediction_failed correlation=%s ticket=%s candidates=%s code=%s",
                correlation_id, body.ticket_id, len(body.candidate_technician_ids), exc.code)
            raise
        LOGGER.info("prediction_succeeded correlation=%s ticket=%s candidates=%s model=%s evaluation=%s latency_ms=%.3f",
            correlation_id, batch.ticket_id, len(batch.predictions), batch.model_version,
            batch.evaluation_timestamp.isoformat(), (perf_counter() - started) * 1000)
        return {
            "ticketId": batch.ticket_id,
            "evaluationTimestamp": batch.evaluation_timestamp.isoformat(),
            "predictions": [
                {"technicianId": row.technician_id,
                 "predictedTechnicalMinutes": row.predicted_technical_minutes,
                 "warnings": list(row.warnings)} for row in batch.predictions
            ],
            "model": {
                "name": loader.metadata["winner_name"],
                "version": batch.model_version,
                "status": batch.model_status,
                "featureContractVersion": loader.contract["contract_version"],
                "syntheticData": loader.metadata["synthetic_data"],
                "productionValidated": loader.metadata["production_validated"],
            },
        }
    return app


app = create_app()
