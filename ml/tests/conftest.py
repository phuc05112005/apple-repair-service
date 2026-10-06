"""Headless plotting configuration for pytest only."""

from __future__ import annotations

import os

os.environ.setdefault("MPLBACKEND", "Agg")
