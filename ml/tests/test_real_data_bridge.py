from __future__ import annotations

import sys
from datetime import datetime as dt
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ML_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_ROOT / "src"))

from repair_duration_data.eligibility import EligibleSample, evaluate_ticket, resolve_technical_action
from repair_duration_data.extractor import extract_snapshot
from repair_duration_data.feature_builder import build_base_feature_row, build_feature_dataset
from repair_duration_data.target_builder import IncompleteStatusHistory, build_actual_technical_minutes
from repair_duration_data.validation import validate_real_dataset
from repair_duration_ml.config import OUTPUT_COLUMNS


def t(hour: int, minute: int = 0) -> dt:
    return dt(2026, 1, 2, hour, minute)


def history(states: list[tuple[str | None, str, dt]]) -> list[dict]:
    return [
        {"history_id": index + 1, "from_status": old, "to_status": new, "changed_at": at}
        for index, (old, new, at) in enumerate(states)
    ]


BASE_HISTORY = history([
    (None, "WAITING_ASSIGNMENT", t(8)),
    ("WAITING_ASSIGNMENT", "ASSIGNED", t(9)),
    ("ASSIGNED", "INSPECTING", t(9, 10)),
    ("INSPECTING", "WAITING_APPROVAL", t(9, 30)),
    ("WAITING_APPROVAL", "REPAIRING", t(10, 30)),
    ("REPAIRING", "WAITING_PART", t(11, 15)),
    ("WAITING_PART", "REPAIRING", t(12, 55)),
    ("REPAIRING", "WAITING_HANDOVER", t(13, 20)),
    ("WAITING_HANDOVER", "HANDED_OVER", t(14)),
])


def item(**updates) -> dict:
    value = {
        "repair_item_id": 1,
        "approval_status": "APPROVED",
        "warranty_source_item_id": None,
        "item_warranty_remedy": None,
        "catalog_warranty_remedy": None,
        "warranty_decision": None,
        "approval_decision_at": None,
        "item_created_at": t(8, 30),
        "catalog_id": 10,
        "catalog_name": "Sửa pin",
        "standard_duration_minutes": 60,
        "service_type_code": "REPAIR",
        "issue_id": 5,
        "service_issue": "Pin",
        "replacement_catalog_id": None,
        "replacement_catalog_name": None,
        "replacement_standard_duration": None,
        "replacement_service_type_code": None,
    }
    value.update(updates)
    return value


def ticket(ticket_id: int = 1, **updates) -> dict:
    value = {
        "ticket_id": ticket_id,
        "ticket_status": "HANDED_OVER",
        "received_at": t(8),
        "actual_repair_completed_at": t(13, 20),
        "branch_id": 1,
        "device_model": "iPhone 16 Pro",
        "device_type": "iPhone",
        "repair_items": [item()],
        "assignments": [{
            "assignment_id": 1,
            "technician_id": 7,
            "assignment_status": "ENDED",
            "assigned_at": t(9),
            "ended_at": t(13, 20),
        }],
        "transfers": [],
        "histories": BASE_HISTORY,
        "plan_changes": [],
    }
    value.update(updates)
    return value


@pytest.mark.parametrize(
    ("states", "start", "end", "current", "expected"),
    [
        ([(None, "WAITING_ASSIGNMENT", t(8)), ("WAITING_ASSIGNMENT", "ASSIGNED", t(9)), ("ASSIGNED", "INSPECTING", t(9, 10)), ("INSPECTING", "REPAIRING", t(9, 30)), ("REPAIRING", "WAITING_HANDOVER", t(10, 15))], t(9), t(10, 15), "WAITING_HANDOVER", 65),
        ([(None, "WAITING_ASSIGNMENT", t(8)), ("WAITING_ASSIGNMENT", "ASSIGNED", t(9)), ("ASSIGNED", "INSPECTING", t(9, 10)), ("INSPECTING", "WAITING_APPROVAL", t(9, 30)), ("WAITING_APPROVAL", "REPAIRING", t(10, 30)), ("REPAIRING", "WAITING_HANDOVER", t(11, 15))], t(9), t(11, 15), "WAITING_HANDOVER", 65),
        ([(None, "WAITING_ASSIGNMENT", t(8)), ("WAITING_ASSIGNMENT", "ASSIGNED", t(9)), ("ASSIGNED", "REPAIRING", t(9, 10)), ("REPAIRING", "WAITING_PART", t(9, 40)), ("WAITING_PART", "REPAIRING", t(10, 40)), ("REPAIRING", "WAITING_HANDOVER", t(11))], t(9), t(11), "WAITING_HANDOVER", 50),
        ([(None, "WAITING_ASSIGNMENT", t(8)), ("WAITING_ASSIGNMENT", "ASSIGNED", t(8, 30)), ("ASSIGNED", "INSPECTING", t(8, 40)), ("INSPECTING", "WAITING_HANDOVER", t(9, 40))], t(9), t(9, 40), "WAITING_HANDOVER", 40),
        ([(None, "WAITING_ASSIGNMENT", t(8)), ("WAITING_ASSIGNMENT", "ASSIGNED", t(9)), ("ASSIGNED", "REPAIRING", t(9, 10)), ("REPAIRING", "WAITING_HANDOVER", t(10, 10))], t(9), t(9, 40), "WAITING_HANDOVER", 30),
        ([(None, "WAITING_ASSIGNMENT", t(8)), ("WAITING_ASSIGNMENT", "ASSIGNED", t(9)), ("ASSIGNED", "INSPECTING", t(9, 10)), ("INSPECTING", "WAITING_APPROVAL", t(9, 30)), ("WAITING_APPROVAL", "REPAIRING", t(10)), ("REPAIRING", "WAITING_PART", t(10, 45)), ("WAITING_PART", "REPAIRING", t(11)), ("REPAIRING", "WAITING_HANDOVER", t(11, 25))], t(9), t(11, 25), "WAITING_HANDOVER", 90),
        ([(None, "WAITING_ASSIGNMENT", t(8)), ("WAITING_ASSIGNMENT", "ASSIGNED", t(9)), ("ASSIGNED", "WAITING_HANDOVER", t(10))], t(9), t(10), "WAITING_HANDOVER", 0),
    ],
)
def test_target_cases(states, start, end, current, expected):
    assert build_actual_technical_minutes(history(states), start, end, current) == expected


def test_target_rejects_incomplete_chain():
    broken = [dict(row) for row in BASE_HISTORY]
    broken[3]["from_status"] = "ASSIGNED"
    with pytest.raises(IncompleteStatusHistory):
        build_actual_technical_minutes(broken, t(9), t(13, 20), "HANDED_OVER")


@pytest.mark.parametrize(
    ("candidate", "action", "warranty"),
    [
        (item(service_type_code="REPAIR"), "REPAIR", 0),
        (item(service_type_code="REPLACEMENT"), "REPLACEMENT", 0),
        (item(warranty_source_item_id=99, item_warranty_remedy="REPAIR", service_type_code="REPAIR"), "REPAIR", 1),
        (item(warranty_source_item_id=99, item_warranty_remedy="REPLACEMENT", service_type_code="REPLACEMENT"), "REPLACEMENT", 1),
    ],
)
def test_warranty_action_mapping(candidate, action, warranty):
    resolved = resolve_technical_action(candidate)
    assert resolved is not None and resolved[0] == action
    assert int(candidate["warranty_source_item_id"] is not None) == warranty


def test_unresolved_warranty_action_is_rejected():
    assert resolve_technical_action(item(warranty_source_item_id=99, service_type_code="WARRANTY")) is None


def test_one_approved_item_and_one_assignment_is_eligible():
    sample, reasons = evaluate_ticket(ticket())
    assert sample is not None and reasons == [] and sample.target_minutes == 90


@pytest.mark.parametrize(
    ("changes", "reason"),
    [
        ({"repair_items": [item(), item(repair_item_id=2)]}, "MULTI_APPROVED_ITEM"),
        ({"assignments": [ticket()["assignments"][0], {**ticket()["assignments"][0], "assignment_id": 2}]}, "MULTIPLE_ASSIGNMENTS"),
        ({"transfers": [{"transfer_status": "ACCEPTED"}]}, "TRANSFER_PRESENT"),
        ({"repair_items": [item(catalog_id=None)]}, "MISSING_CATALOG"),
        ({"assignments": [{**ticket()["assignments"][0], "ended_at": None}]}, "MISSING_ASSIGNMENT_END"),
        ({"histories": []}, "INCOMPLETE_STATUS_HISTORY"),
    ],
)
def test_eligibility_exclusions(changes, reason):
    sample, reasons = evaluate_ticket(ticket(**changes))
    assert sample is None and reason in reasons


def raw_row(sample_id: str, predicted: dt, completed: dt, duration: int, issue: str = "Pin", catalog: str = "CATALOG_10") -> dict:
    return {
        "sample_id": sample_id,
        "prediction_timestamp": predicted,
        "completed_at": completed,
        "device_type": "iPhone",
        "device_model": "iPhone 16 Pro",
        "service_issue": issue,
        "technical_action": "REPAIR",
        "is_warranty": 0,
        "catalog_service": catalog,
        "standard_duration_minutes": 60,
        "technician_id": "TECH_07",
        "branch_id": "BRANCH_01",
        "prediction_month": "M01",
        "prediction_weekday": "FRI",
        "actual_technical_minutes": duration,
    }


def test_strict_history_completed_only_and_same_timestamp_excluded():
    from repair_duration_ml.features import attach_historical_features

    rows = [
        raw_row("A", t(8), t(9, 30), 60),
        raw_row("B", t(8, 30), t(12), 120),  # started earlier, incomplete at C prediction
        raw_row("C", t(10), t(11), 90),
        raw_row("D", t(11), t(13), 75),  # C completes exactly at D prediction
    ]
    frame = attach_historical_features(rows)
    c = frame.loc[frame.sample_id == "C"].iloc[0]
    d = frame.loc[frame.sample_id == "D"].iloc[0]
    assert c.technician_jobs_completed_before == 1
    assert c.technician_average_duration_before == 60
    assert c.technician_issue_jobs_before == 1
    assert c.technician_catalog_jobs_before == 1
    assert c.technician_historical_efficiency_before == 1.0
    assert d.technician_jobs_completed_before == 1


def test_history_issue_and_catalog_scopes_are_independent():
    from repair_duration_ml.features import attach_historical_features

    rows = [
        raw_row("A", t(8), t(9), 60),
        raw_row("B", t(8, 10), t(9, 10), 120, issue="Màn hình", catalog="CATALOG_20"),
        raw_row("C", t(10), t(11), 90, issue="Pin", catalog="CATALOG_20"),
    ]
    current = attach_historical_features(rows).iloc[-1]
    assert current.technician_jobs_completed_before == 2
    assert current.technician_average_duration_before == 90
    assert current.technician_issue_jobs_before == 1
    assert current.technician_issue_average_duration_before == 60
    assert current.technician_catalog_jobs_before == 1
    assert current.technician_catalog_average_duration_before == 120
    assert current.technician_historical_efficiency_before == 1.5


def test_cold_start_uses_zero_counts_and_nan_statistics():
    from repair_duration_ml.features import attach_historical_features

    row = attach_historical_features([raw_row("A", t(8), t(9), 60)]).iloc[0]
    assert row.technician_jobs_completed_before == 0
    assert row.technician_issue_jobs_before == 0
    assert row.technician_catalog_jobs_before == 0
    assert np.isnan(row.technician_average_duration_before)
    assert np.isnan(row.technician_issue_efficiency_before)
    assert np.isnan(row.technician_catalog_efficiency_before)


def test_extractor_and_direct_builder_have_full_feature_parity():
    previous = ticket(1)
    current = ticket(2)
    current["assignments"] = [{**current["assignments"][0], "assignment_id": 2, "assigned_at": dt(2026, 1, 3, 9), "ended_at": dt(2026, 1, 3, 10, 30)}]
    current["actual_repair_completed_at"] = dt(2026, 1, 3, 10, 30)
    current["repair_items"] = [item(repair_item_id=2, item_created_at=dt(2026, 1, 3, 8, 30))]
    current["histories"] = history([
        (None, "WAITING_ASSIGNMENT", dt(2026, 1, 3, 8)),
        ("WAITING_ASSIGNMENT", "ASSIGNED", dt(2026, 1, 3, 9)),
        ("ASSIGNED", "REPAIRING", dt(2026, 1, 3, 9, 10)),
        ("REPAIRING", "WAITING_HANDOVER", dt(2026, 1, 3, 10, 30)),
        ("WAITING_HANDOVER", "HANDED_OVER", dt(2026, 1, 3, 11)),
    ])
    offline = extract_snapshot([previous, current])
    direct_samples = [evaluate_ticket(source)[0] for source in (previous, current)]
    direct = build_feature_dataset([sample for sample in direct_samples if sample is not None])
    pd.testing.assert_frame_equal(offline.dataset, direct)
    assert list(offline.dataset.columns) == OUTPUT_COLUMNS
    validate_real_dataset(offline.dataset)


def test_plan_changed_after_assignment_is_audited():
    changed = ticket(plan_changes=[{"created_at": t(9, 20)}])
    sample, reasons = evaluate_ticket(changed)
    assert sample is None and "PLAN_CHANGED_AFTER_ASSIGNMENT" in reasons


def test_empty_extraction_retains_exact_schema():
    result = extract_snapshot([])
    assert list(result.dataset.columns) == OUTPUT_COLUMNS
    assert result.summary["tickets_scanned"] == 0
    validate_real_dataset(result.dataset)
