"""Executable V3 repair-duration model competition.

Example from the repository root:
    python ml/train_repair_duration_models.py --data ml/data/synthetic_repair_duration_v3.csv --output-dir ml/models/experimental_v3
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent
os.environ.setdefault("MPLBACKEND", "Agg")
sys.path.insert(0, str(ML_ROOT / "src"))

from repair_duration_ml_v3.training import run_competition  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data",
        type=Path,
        default=ML_ROOT / "data" / "synthetic_repair_duration_v3.csv",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ML_ROOT / "models" / "experimental_v3",
    )
    parser.add_argument("--cv-splits", type=int, default=4)
    parser.add_argument("--test-fraction", type=float, default=0.15)
    parser.add_argument("--search-iterations", type=int, default=12)
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="Use smaller estimators for CI execution; never use smoke metrics for the final report.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
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
    print("\nDevelopment temporal CV:")
    print(result.cv_table.to_string(index=False))
    print("\nUntouched holdout test:")
    print(result.test_table.to_string(index=False))
    print("\nArtifacts:", args.output_dir.resolve())


if __name__ == "__main__":
    main()
