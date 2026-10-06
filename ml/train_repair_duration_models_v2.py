"""Frozen executable entry point for reproducing the archived V2 experiment."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent
os.environ.setdefault("MPLBACKEND", "Agg")
sys.path.insert(0, str(ML_ROOT / "src"))

from repair_duration_ml.training import run_competition  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data", type=Path,
        default=ML_ROOT / "data" / "synthetic_repair_duration_v2.csv",
    )
    parser.add_argument(
        "--output-dir", type=Path,
        default=ML_ROOT / "models" / "experimental_v2",
    )
    parser.add_argument("--cv-splits", type=int, default=4)
    parser.add_argument("--test-fraction", type=float, default=.15)
    parser.add_argument("--search-iterations", type=int, default=8)
    parser.add_argument("--smoke", action="store_true")
    args = parser.parse_args()
    result = run_competition(
        args.data,
        output_dir=args.output_dir,
        cv_splits=args.cv_splits,
        test_fraction=args.test_fraction,
        search_iterations=args.search_iterations,
        smoke=args.smoke,
    )
    print("Locked winner:", result.winner_name)
    print(result.winner_reason)


if __name__ == "__main__":
    main()
