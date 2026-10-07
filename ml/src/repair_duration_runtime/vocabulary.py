from __future__ import annotations

import json
from pathlib import Path

from repair_duration_data.catalog import normalize_catalog_service_label


class TrainingVocabulary:
    def __init__(self, path: str | Path) -> None:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        values = payload.get("catalog_service")
        if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
            raise ValueError("Invalid category vocabulary artifact")
        self.catalog_services = frozenset(normalize_catalog_service_label(value) for value in values)
        self.version = str(payload.get("vocabulary_version", "unknown"))

    def contains_catalog(self, label: str) -> bool:
        return normalize_catalog_service_label(label) in self.catalog_services
