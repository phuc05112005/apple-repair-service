from __future__ import annotations

from datetime import datetime

from .errors import RuntimeInferenceError
from .feature_service import RuntimeFeatureService, normalize_evaluation_timestamp
from .model_loader import ExperimentalModelLoader
from .predictor import RepairDurationPredictor
from .repository import RuntimeRepository
from .schemas import PredictionBatch


class RepairDurationInferenceService:
    MAX_CANDIDATES = 50

    def __init__(self, repository: RuntimeRepository, loader: ExperimentalModelLoader) -> None:
        self.repository = repository
        self.loader = loader
        self.features = RuntimeFeatureService()
        self.predictor = RepairDurationPredictor(loader)

    def predict_candidates(self, ticket_id: int, technician_ids: list[int], evaluation_timestamp: datetime) -> PredictionBatch:
        if ticket_id <= 0:
            raise RuntimeInferenceError("INVALID_TICKET_ID", "ticketId must be positive", 422)
        if not technician_ids or len(technician_ids) > self.MAX_CANDIDATES:
            raise RuntimeInferenceError("INVALID_CANDIDATES", "technicianIds must contain 1 to 50 values", 422)
        if any(value <= 0 for value in technician_ids) or len(set(technician_ids)) != len(technician_ids):
            raise RuntimeInferenceError("INVALID_CANDIDATES", "technicianIds must be unique positive integers", 422)
        at = normalize_evaluation_timestamp(evaluation_timestamp)
        context = self.repository.load_context(ticket_id)
        self.repository.validate_candidates(technician_ids)
        history = self.repository.load_history()
        frame = self.features.build(context, technician_ids, at, history)
        predictions = self.predictor.predict(frame, technician_ids)
        return PredictionBatch(ticket_id, at, self.loader.metadata["experiment_version"],
            self.loader.metadata["model_status"], predictions)

    def readiness(self) -> tuple[bool, dict]:
        model_ready = self.loader.is_loaded
        database_ready = self.repository.ping()
        return model_ready and database_ready, {"model": model_ready, "database": database_ready}
