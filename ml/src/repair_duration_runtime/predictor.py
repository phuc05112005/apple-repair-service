from __future__ import annotations

import math

import pandas as pd

from .errors import RuntimeInferenceError
from .model_loader import ExperimentalModelLoader
from .schemas import CandidatePrediction


class RepairDurationPredictor:
    def __init__(self, loader: ExperimentalModelLoader) -> None:
        self.loader = loader.load()

    def predict(self, frame: pd.DataFrame, technician_ids: list[int]) -> tuple[CandidatePrediction, ...]:
        if len(frame) != len(technician_ids):
            raise RuntimeInferenceError("FEATURE_CONTRACT_VIOLATION", "Candidate and feature counts differ", 500)
        values = self.loader.model.predict(frame)  # type: ignore[union-attr]
        results = []
        vocabulary = self.loader.vocabulary
        for index, (technician_id, value) in enumerate(zip(technician_ids, values)):
            minutes = float(value)
            if not math.isfinite(minutes) or minutes <= 0:
                raise RuntimeInferenceError("INVALID_MODEL_OUTPUT", "Model returned a non-positive or non-finite duration", 500)
            warnings: list[str] = []
            if int(frame.iloc[index]["technician_jobs_completed_before"]) == 0:
                warnings.append("COLD_START_TECHNICIAN")
            if vocabulary is not None and not vocabulary.contains_catalog(str(frame.iloc[index]["catalog_service"])):
                warnings.append("UNSEEN_CATALOG_CATEGORY")
            results.append(CandidatePrediction(technician_id, minutes, tuple(warnings)))
        return tuple(results)
