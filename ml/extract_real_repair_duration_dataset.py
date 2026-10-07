#!/usr/bin/env python3
"""Extract a PII-free real repair-duration dataset from MySQL without writes."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

ML_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_ROOT / "src"))

from repair_duration_data.db import DatabaseConfig, load_source_snapshot
from repair_duration_data.extractor import extract_snapshot
from repair_duration_data.validation import validate_real_dataset


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ML_ROOT / "data/real/real_repair_duration_v1.csv")
    parser.add_argument("--summary-output", type=Path, default=ML_ROOT / "data/real/extraction_summary.json")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing output files")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        tickets = load_source_snapshot(DatabaseConfig.from_environment(), args.limit)
    except Exception as exc:  # CLI boundary: never print credentials or a data-bearing traceback.
        print(f"extraction failed: {exc}", file=sys.stderr)
        return 2
    print("DB connected")
    result = extract_snapshot(tickets)
    validate_real_dataset(result.dataset)
    missing = {column: int(result.dataset[column].isna().sum()) for column in result.dataset.columns}
    timestamps = pd.to_datetime(result.dataset["prediction_timestamp"])
    targets = result.dataset["actual_technical_minutes"]
    target_distribution = {
        "count": int(targets.count()),
        "min": None if targets.empty else float(targets.min()),
        "max": None if targets.empty else float(targets.max()),
        "mean": None if targets.empty else float(targets.mean()),
        "median": None if targets.empty else float(targets.median()),
        "q25": None if targets.empty else float(targets.quantile(0.25)),
        "q75": None if targets.empty else float(targets.quantile(0.75)),
    }
    summary = dict(result.summary)
    summary.update({
        "dataset_rows": len(result.dataset),
        "dataset_columns": len(result.dataset.columns),
        "date_range": {
            "prediction_timestamp_min": None if timestamps.empty else timestamps.min().isoformat(),
            "prediction_timestamp_max": None if timestamps.empty else timestamps.max().isoformat(),
        },
        "missing_values": missing,
        "technical_action_distribution": {
            str(key): int(value)
            for key, value in result.dataset["technical_action"].value_counts().sort_index().items()
        },
        "warranty_distribution": {
            str(int(key)): int(value)
            for key, value in result.dataset["is_warranty"].value_counts().sort_index().items()
        },
        "target_distribution": target_distribution,
        "validation": "PASS",
        "pipeline_status": "REAL-DATA PIPELINE FUNCTIONALLY VERIFIED",
        "production_validation": "INSUFFICIENT REAL DATA FOR STATISTICAL PRODUCTION VALIDATION",
    })
    print(f"scanned: {summary['tickets_scanned']}")
    print(f"eligible: {summary['eligible_samples']}")
    print(f"excluded: {summary['excluded_total']}")
    print("validation result: PASS")
    if not args.dry_run:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        result.dataset.to_csv(args.output, index=False, date_format="%Y-%m-%dT%H:%M:%S")
        args.summary_output.parent.mkdir(parents=True, exist_ok=True)
        args.summary_output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"output path: {args.output}")
    else:
        print("output path: dry-run (no files written)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
