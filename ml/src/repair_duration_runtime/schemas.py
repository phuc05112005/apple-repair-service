from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class PredictionContext:
    ticket_id: int
    device_type: str
    device_model: str
    service_issue: str
    technical_action: str
    is_warranty: int
    catalog_id: int
    catalog_service: str
    standard_duration_minutes: int
    branch_id: int


@dataclass(frozen=True)
class CandidatePrediction:
    technician_id: int
    predicted_technical_minutes: float
    warnings: tuple[str, ...]


@dataclass(frozen=True)
class PredictionBatch:
    ticket_id: int
    evaluation_timestamp: datetime
    model_version: str
    model_status: str
    predictions: tuple[CandidatePrediction, ...]
