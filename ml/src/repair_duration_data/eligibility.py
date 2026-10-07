"""Conservative Version 1 sample eligibility and warranty normalization."""

from __future__ import annotations

from dataclasses import dataclass

from .target_builder import IncompleteStatusHistory, build_actual_technical_minutes


@dataclass(frozen=True)
class EligibleSample:
    ticket: dict
    item: dict
    assignment: dict
    technical_action: str
    catalog_id: int
    catalog_name: str
    standard_duration_minutes: int
    target_minutes: int


def resolve_technical_action(item: dict) -> tuple[str, int, str, int] | None:
    is_warranty = item.get("warranty_source_item_id") is not None
    service_type = item.get("service_type_code")
    if not is_warranty:
        if service_type not in {"REPAIR", "REPLACEMENT"}:
            return None
        return service_type, int(item["catalog_id"]), str(item["catalog_name"]), int(item["standard_duration_minutes"])

    remedy = item.get("item_warranty_remedy") or item.get("catalog_warranty_remedy")
    if remedy not in {"REPAIR", "REPLACEMENT"} and service_type in {"REPAIR", "REPLACEMENT"}:
        remedy = service_type
    if remedy not in {"REPAIR", "REPLACEMENT"}:
        return None
    if remedy == "REPLACEMENT" and item.get("replacement_catalog_id") is not None:
        if item.get("replacement_service_type_code") != "REPLACEMENT":
            return None
        return remedy, int(item["replacement_catalog_id"]), str(item["replacement_catalog_name"]), int(item["replacement_standard_duration"])
    if service_type not in {"REPAIR", "REPLACEMENT"}:
        return None
    if service_type != remedy:
        return None
    return remedy, int(item["catalog_id"]), str(item["catalog_name"]), int(item["standard_duration_minutes"])


def evaluate_ticket(ticket: dict) -> tuple[EligibleSample | None, list[str]]:
    reasons: list[str] = []
    approved = [row for row in ticket.get("repair_items", []) if row.get("approval_status") == "APPROVED"]
    if len(approved) > 1:
        reasons.append("MULTI_APPROVED_ITEM")
    elif not approved:
        reasons.append("NO_APPROVED_ITEM")
    assignments = ticket.get("assignments", [])
    if len(assignments) > 1:
        reasons.append("MULTIPLE_ASSIGNMENTS")
    elif not assignments:
        reasons.append("MISSING_ASSIGNMENT")
    if any(row.get("transfer_status") == "ACCEPTED" for row in ticket.get("transfers", [])):
        reasons.append("TRANSFER_PRESENT")
    if reasons:
        return None, reasons

    item, assignment = approved[0], assignments[0]
    if item.get("catalog_id") is None:
        reasons.append("MISSING_CATALOG")
    if assignment.get("ended_at") is None:
        reasons.append("MISSING_ASSIGNMENT_END")
    assigned_at = assignment.get("assigned_at")
    if assigned_at is None:
        reasons.append("INCONSISTENT_TIMELINE")
    # The database stores final RepairItem state, not temporal versions. Requiring one
    # total item and no later plan-change snapshot makes plan-at-assignment provable.
    if len(ticket.get("repair_items", [])) != 1:
        reasons.append("PLAN_CHANGED_AFTER_ASSIGNMENT")
    if assigned_at is not None:
        if item.get("item_created_at") is None or item["item_created_at"] > assigned_at:
            reasons.append("PLAN_NOT_KNOWN_AT_ASSIGNMENT")
        decision_at = item.get("approval_decision_at")
        if decision_at is not None and decision_at > assigned_at:
            reasons.append("PLAN_NOT_KNOWN_AT_ASSIGNMENT")
        if any(row.get("created_at") is not None and row["created_at"] > assigned_at for row in ticket.get("plan_changes", [])):
            reasons.append("PLAN_CHANGED_AFTER_ASSIGNMENT")
        # A legacy WARRANTY catalog can receive its remedy after assignment, but the
        # schema has no warranty-decision timestamp. It cannot satisfy the as-of proof.
        if item.get("service_type_code") == "WARRANTY":
            reasons.append("AMBIGUOUS_WARRANTY_DECISION_TIME")
    resolved = None if item.get("catalog_id") is None else resolve_technical_action(item)
    if resolved is None:
        reasons.append("UNRESOLVED_TECHNICAL_ACTION")
    if reasons:
        return None, sorted(set(reasons))

    try:
        target = build_actual_technical_minutes(
            ticket.get("histories", []), assigned_at, assignment["ended_at"], ticket["ticket_status"]
        )
    except IncompleteStatusHistory:
        return None, ["INCOMPLETE_STATUS_HISTORY"]
    completed_at = ticket.get("actual_repair_completed_at")
    if completed_at is None or completed_at <= assigned_at or assignment["ended_at"] < assigned_at:
        reasons.append("INCONSISTENT_TIMELINE")
    if target <= 0:
        reasons.append("INVALID_TARGET")
    action, catalog_id, catalog_name, standard = resolved
    if standard <= 0:
        reasons.append("INVALID_STANDARD_DURATION")
    if reasons:
        return None, sorted(set(reasons))
    return EligibleSample(ticket, item, assignment, action, catalog_id, catalog_name, standard, target), []
