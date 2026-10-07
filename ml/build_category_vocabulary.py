#!/usr/bin/env python3
"""Build the descriptive training-category vocabulary without changing the model."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pandas as pd

ML_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_ROOT / "src"))

from repair_duration_data.catalog import normalize_catalog_service_label


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    source = ML_ROOT / "data" / "synthetic_repair_duration.csv"
    output = ML_ROOT / "models" / "experimental" / "category_vocabulary.json"
    frame = pd.read_csv(source, usecols=["catalog_service"])
    values = sorted({normalize_catalog_service_label(value) for value in frame["catalog_service"]})
    payload = {
        "vocabulary_version": "repair-duration-training-categories-v1",
        "source_dataset": "ml/data/synthetic_repair_duration.csv",
        "source_dataset_sha256": sha256(source),
        "normalization": "trim surrounding whitespace only; preserve Unicode, case, internal whitespace and punctuation",
        "catalog_service_count": len(values),
        "catalog_service": values,
        "policy": "descriptive only; unseen values are accepted and emit UNSEEN_CATALOG_CATEGORY",
    }
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(values)} catalog categories to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
