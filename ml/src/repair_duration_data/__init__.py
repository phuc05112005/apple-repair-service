"""Read-only bridge from Apple Repair Service data to the frozen ML contract."""

from .extractor import ExtractionResult, extract_snapshot
from .feature_builder import build_feature_dataset
from .validation import validate_real_dataset

__all__ = [
    "ExtractionResult",
    "build_feature_dataset",
    "extract_snapshot",
    "validate_real_dataset",
]
