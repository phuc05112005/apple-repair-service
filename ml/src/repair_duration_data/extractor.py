"""Orchestrate eligibility, exclusion audit, and shared feature building."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

import pandas as pd

from .eligibility import EligibleSample, evaluate_ticket
from .feature_builder import build_feature_dataset


@dataclass(frozen=True)
class ExtractionResult:
    dataset: pd.DataFrame
    summary: dict
    eligible_samples: list[EligibleSample]


def extract_snapshot(tickets: list[dict]) -> ExtractionResult:
    eligible: list[EligibleSample] = []
    excluded: list[dict] = []
    reason_counts: Counter[str] = Counter()
    for ticket in tickets:
        sample, reasons = evaluate_ticket(ticket)
        if sample is not None:
            eligible.append(sample)
        else:
            unique = sorted(set(reasons))
            reason_counts.update(unique)
            excluded.append({"sample_id": f"REAL_TICKET_{int(ticket['ticket_id']):08d}", "reasons": unique})
    dataset = build_feature_dataset(eligible)
    summary = {
        "tickets_scanned": len(tickets),
        "eligible_samples": len(eligible),
        "excluded_total": len(excluded),
        "count_by_reason": dict(sorted(reason_counts.items())),
        "excluded_samples": excluded,
    }
    return ExtractionResult(dataset, summary, eligible)
