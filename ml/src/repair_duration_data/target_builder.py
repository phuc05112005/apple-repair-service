"""Reconstruct the production technical-duration semantics from status history."""

from __future__ import annotations

from datetime import datetime

ACTIVE_STATUSES = {"INSPECTING", "REPAIRING"}


class IncompleteStatusHistory(ValueError):
    pass


def _ordered_complete_history(histories: list[dict], current_status: str) -> list[dict]:
    if not histories:
        raise IncompleteStatusHistory("status history is empty")
    ordered = sorted(histories, key=lambda row: (row.get("changed_at") or datetime.min, row.get("history_id") or 0))
    previous_status = None
    previous_time = None
    for index, row in enumerate(ordered):
        changed_at = row.get("changed_at")
        to_status = row.get("to_status")
        if changed_at is None or to_status is None:
            raise IncompleteStatusHistory("history row is incomplete")
        if row.get("from_status") != previous_status:
            raise IncompleteStatusHistory("status chain is discontinuous")
        if previous_time is not None and changed_at < previous_time:
            raise IncompleteStatusHistory("status timestamps are not ordered")
        if row.get("from_status") == to_status:
            raise IncompleteStatusHistory("history repeats the same state")
        if index == 0 and to_status != "WAITING_ASSIGNMENT":
            raise IncompleteStatusHistory("history does not begin at WAITING_ASSIGNMENT")
        previous_status, previous_time = to_status, changed_at
    if previous_status != current_status:
        raise IncompleteStatusHistory("history does not reach the current ticket status")
    return ordered


def build_actual_technical_minutes(
    histories: list[dict],
    assignment_start: datetime,
    assignment_end: datetime,
    current_status: str,
) -> int:
    """Sum INSPECTING/REPAIRING intervals intersected with one assignment."""
    if assignment_start is None or assignment_end is None or assignment_end < assignment_start:
        raise IncompleteStatusHistory("assignment interval is invalid")
    ordered = _ordered_complete_history(histories, current_status)
    total_seconds = 0.0
    for index, row in enumerate(ordered):
        if row["to_status"] not in ACTIVE_STATUSES:
            continue
        if index + 1 >= len(ordered):
            raise IncompleteStatusHistory("active status has no closing transition")
        interval_start = max(row["changed_at"], assignment_start)
        interval_end = min(ordered[index + 1]["changed_at"], assignment_end)
        if interval_end > interval_start:
            total_seconds += (interval_end - interval_start).total_seconds()
    return int(total_seconds // 60)
