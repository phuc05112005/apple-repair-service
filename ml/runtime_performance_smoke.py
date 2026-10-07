#!/usr/bin/env python3
"""Repeatable local latency smoke test; not a production benchmark."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from time import perf_counter
from zoneinfo import ZoneInfo

ML_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_ROOT / "src"))

from repair_duration_runtime.feature_service import RuntimeFeatureService
from repair_duration_runtime.model_loader import ExperimentalModelLoader
from repair_duration_runtime.predictor import RepairDurationPredictor
from repair_duration_runtime.schemas import PredictionContext


def main() -> int:
    started = perf_counter()
    loader = ExperimentalModelLoader(ML_ROOT / "models/experimental").load()
    load_ms = (perf_counter() - started) * 1000
    context = PredictionContext(1, "iPhone", "iPhone 14", "Pin", "REPLACEMENT", 0,
                                15, "Thay pin iPhone 14", 60, 1)
    feature_service = RuntimeFeatureService()
    predictor = RepairDurationPredictor(loader)
    at = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))
    measurements = {}
    for count in (1, 3, 10):
        durations = []
        for _ in range(20):
            started = perf_counter()
            frame = feature_service.build(context, list(range(1, count + 1)), at, [])
            predictor.predict(frame, list(range(1, count + 1)))
            durations.append((perf_counter() - started) * 1000)
        measurements[str(count)] = {"median_ms": sorted(durations)[len(durations)//2], "max_ms": max(durations)}
    output = {"model_load_ms": load_ms, "candidate_batches": measurements,
              "scope": "local smoke only; no production SLA claim"}
    path = ML_ROOT / "models/experimental/runtime_performance_smoke.json"
    path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
