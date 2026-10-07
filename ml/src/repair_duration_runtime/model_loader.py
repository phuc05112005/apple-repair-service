from __future__ import annotations

import json
import platform
from pathlib import Path
from threading import Lock

import catboost
import numpy
import pandas
from catboost import CatBoostRegressor

from repair_duration_ml.config import (CATEGORICAL_FEATURES, FEATURE_COLUMNS,
    FEATURE_CONTRACT_VERSION, NUMERIC_FEATURES, TARGET)
from .errors import RuntimeInferenceError
from .vocabulary import TrainingVocabulary


class ExperimentalModelLoader:
    """Validate and load the native model once for the process lifetime."""

    def __init__(self, artifact_dir: str | Path) -> None:
        self.artifact_dir = Path(artifact_dir)
        self.model: CatBoostRegressor | None = None
        self.metadata: dict = {}
        self.contract: dict = {}
        self.vocabulary: TrainingVocabulary | None = None
        self.load_count = 0
        self.warnings: list[str] = []
        self._lock = Lock()

    def load(self) -> "ExperimentalModelLoader":
        if self.model is not None:
            return self
        with self._lock:
            if self.model is not None:
                return self
            try:
                self.metadata = json.loads((self.artifact_dir / "metadata.json").read_text(encoding="utf-8"))
                self.contract = json.loads((self.artifact_dir / "feature_contract.json").read_text(encoding="utf-8"))
                if self.metadata.get("winner_name") != "CatBoostRegressor":
                    raise ValueError("winner is not CatBoostRegressor")
                if self.contract.get("contract_version") != FEATURE_CONTRACT_VERSION:
                    raise ValueError("unsupported feature contract version")
                if self.contract.get("features_in_order") != FEATURE_COLUMNS:
                    raise ValueError("feature order differs from frozen 20-feature contract")
                if self.contract.get("target") != TARGET:
                    raise ValueError("target differs from frozen contract")
                if self.contract.get("categorical_features") != CATEGORICAL_FEATURES:
                    raise ValueError("categorical feature semantics differ from contract")
                if self.contract.get("numeric_features") != NUMERIC_FEATURES:
                    raise ValueError("numeric feature semantics differ from contract")
                if self.metadata.get("model_status") != "EXPERIMENTAL_DEMO":
                    raise ValueError("unexpected model status")
                if self.metadata.get("synthetic_data") is not True or self.metadata.get("production_validated") is not False:
                    raise ValueError("experimental model flags are invalid")
                trained_version = str(self.metadata.get("library_versions", {}).get("catboost", ""))
                if trained_version.split(".")[:2] != catboost.__version__.split(".")[:2]:
                    raise ValueError(f"CatBoost major/minor mismatch: trained={trained_version}, runtime={catboost.__version__}")
                if trained_version != catboost.__version__:
                    self.warnings.append("CATBOOST_PATCH_VERSION_MISMATCH")
                model = CatBoostRegressor()
                model.load_model(str(self.artifact_dir / self.metadata["model_file"]))
                feature_names = list(model.feature_names_)
                if feature_names and feature_names != FEATURE_COLUMNS:
                    raise ValueError("native model feature names differ from contract")
                self.vocabulary = TrainingVocabulary(self.artifact_dir / "category_vocabulary.json")
                self.model = model
                self.load_count += 1
            except Exception as exc:
                raise RuntimeInferenceError("MODEL_LOAD_FAILED", f"Model artifacts are not ready: {exc}", 503) from exc
        return self

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def info(self) -> dict:
        self.load()
        return {
            "modelName": self.metadata["winner_name"],
            "modelVersion": self.metadata["experiment_version"],
            "featureContractVersion": self.contract["contract_version"],
            "modelStatus": self.metadata["model_status"],
            "syntheticData": self.metadata["synthetic_data"],
            "productionValidated": self.metadata["production_validated"],
            "featureCount": len(FEATURE_COLUMNS),
            "runtimeVersions": {"python": platform.python_version(), "catboost": catboost.__version__,
                "pandas": pandas.__version__, "numpy": numpy.__version__},
            "warnings": list(self.warnings),
        }
