"""Create deterministic transaction fixtures through the real APIs of the isolated demo stack.

This script must never target the canonical development database. It refuses any
base URL other than the explicit demo URL unless ALLOW_NON_DEFAULT_DEMO_URL=true.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = os.getenv("DEMO_API_BASE_URL", "http://127.0.0.1:8088").rstrip("/")
ADMIN_PASSWORD = os.getenv("DEMO_ADMIN_PASSWORD", "Admin-demo-2026!")
RECEPTIONIST_PASSWORD = os.getenv("DEMO_RECEPTIONIST_PASSWORD", "123456")
TECHNICIAN_PASSWORD = os.getenv("DEMO_TECHNICIAN_PASSWORD", "123456")
OUTPUT = Path(os.getenv("DEMO_MATRIX_OUTPUT", "target/operational-data/demo-state-matrix.json"))
VN = ZoneInfo("Asia/Ho_Chi_Minh")

if BASE_URL != "http://127.0.0.1:8088" and os.getenv("ALLOW_NON_DEFAULT_DEMO_URL") != "true":
    raise SystemExit("Refusing non-default target. Set ALLOW_NON_DEFAULT_DEMO_URL=true only for an isolated demo stack.")


def api(method: str, path: str, body=None, token: str | None = None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json; charset=utf-8"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = response.read()
            return json.loads(payload.decode("utf-8")) if payload else None
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} returned {error.code}: {detail}") from error


def login(username: str, password: str) -> str:
    return api("POST", "/api/v1/auth/login", {"username": username, "password": password})["accessToken"]


def create_walk_in(label: str, branch_id: int, receptionist_token: str):
    suffix = f"{list(TICKET_STATES).index(label) + 1:02d}"
    return api("POST", "/api/v1/internal/service-tickets/walk-in", {
        "customerFullName": f"Demo Matrix {label}",
        "phone": f"09070000{suffix}",
        "branchId": branch_id,
        "deviceModelId": 405,
        "serialNumber": f"DEMO-MATRIX-{label}",
        "storage": "128 GB",
        "receivedCondition": "Thiết bị fixture trong database demo cách ly",
        "serviceCatalogItemIds": [1129],
        "customerReportedIssue": "Fixture kiểm thử ma trận trạng thái",
        "authorizedScope": "Chỉ dùng để xác minh full stack local",
    }, receptionist_token)


def assign(ticket_id: int, receptionist_token: str, users_by_id: dict[int, dict], reserved: set[int]):
    recommendations = api("GET", f"/api/v1/internal/service-tickets/{ticket_id}/technician-recommendations", token=receptionist_token)
    eligible = [candidate for candidate in recommendations if candidate["eligible"]]
    candidate = next((item for item in eligible if item["technicianId"] not in reserved), eligible[0])
    api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/assignments", {
        "technicianId": candidate["technicianId"], "source": "MANUAL_OVERRIDE",
    }, receptionist_token)
    reserved.add(candidate["technicianId"])
    username = users_by_id[candidate["technicianId"]]["username"]
    return candidate, login(username, TECHNICIAN_PASSWORD)


TICKET_STATES = (
    "WAITING_ASSIGNMENT", "ASSIGNED", "INSPECTING", "WAITING_APPROVAL",
    "REPAIRING", "WAITING_PART", "WAITING_HANDOVER", "HANDED_OVER",
)


def seed_ticket_matrix(admin_token: str, receptionist_token: str):
    users = api("GET", "/api/v1/admin/users", token=admin_token)
    users_by_id = {user["id"]: user for user in users}
    existing = api("GET", "/api/v1/internal/service-tickets?query=Demo%20Matrix", token=receptionist_token)
    existing_by_name = {item["customerFullName"]: item for item in existing}
    reserved: set[int] = set()
    created = []

    for index, state in enumerate(TICKET_STATES):
        marker = f"Demo Matrix {state}"
        if marker in existing_by_name:
            actual = existing_by_name[marker]["status"]
            if actual != state:
                raise RuntimeError(f"Existing fixture {marker} has status {actual}, expected {state}.")
            created.append({"ticketId": existing_by_name[marker]["ticketId"], "status": state, "existing": True})
            continue

        detail = create_walk_in(state, 1070 if index % 2 == 0 else 1071, receptionist_token)
        ticket_id = detail["ticket"]["id"]
        if state == "WAITING_ASSIGNMENT":
            created.append({"ticketId": ticket_id, "status": state, "existing": False})
            continue

        _, technician_token = assign(ticket_id, receptionist_token, users_by_id, reserved)
        if state == "ASSIGNED":
            created.append({"ticketId": ticket_id, "status": state, "existing": False})
            continue

        api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/inspection/start", {}, technician_token)
        if state == "INSPECTING":
            created.append({"ticketId": ticket_id, "status": state, "existing": False})
            continue

        needs_approval = state == "WAITING_APPROVAL"
        detail = api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/inspection", {
            "inspectionResult": "Kết quả fixture được ghi qua API nghiệp vụ",
            "requiresCustomerApproval": needs_approval,
            "confirmationMethod": None if needs_approval else "DIRECT",
            "confirmationNote": None if needs_approval else "Khách xác nhận trực tiếp trong fixture demo",
            "items": [{"serviceCatalogItemId": 1129, "basePrice": 790000, "finalPrice": 790000, "warrantySourceItemId": None}],
        }, technician_token)
        if state in {"WAITING_APPROVAL", "REPAIRING"}:
            created.append({"ticketId": ticket_id, "status": state, "existing": False})
            continue
        if state == "WAITING_PART":
            api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/wait-for-part", {"note": "Fixture chờ linh kiện"}, technician_token)
            created.append({"ticketId": ticket_id, "status": state, "existing": False})
            continue

        api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/finish-repair", {}, technician_token)
        if state == "WAITING_HANDOVER":
            created.append({"ticketId": ticket_id, "status": state, "existing": False})
            continue
        api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/payment", {"paymentMethod": "CASH"}, receptionist_token)
        api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/handover", {}, receptionist_token)
        created.append({"ticketId": ticket_id, "status": state, "existing": False, "positivePayment": True})

    return created


def local_time(value: datetime) -> tuple[str, str]:
    localized = value.astimezone(VN)
    return localized.strftime("%Y-%m-%d"), localized.strftime("%H:%M:%S")


def create_slot(branch_id: int, start: datetime, end: datetime, admin_token: str):
    date, start_time = local_time(start)
    end_date, end_time = local_time(end)
    if date != end_date:
        raise RuntimeError("Demo slot may not cross a calendar day.")
    return api("POST", "/api/v1/admin/appointment-slots", {
        "branchId": branch_id, "slotDate": date, "startTime": start_time, "endTime": end_time,
    }, admin_token)


def create_appointment(status: str, slot_id: int):
    suffix = f"{list(APPOINTMENT_STATES).index(status) + 1:02d}"
    return api("POST", "/api/v1/appointments", {
        "customerFullName": f"Demo Appointment {status}", "phone": f"09071111{suffix}",
        "appointmentSlotId": slot_id, "note": "Fixture trạng thái lịch hẹn trong demo DB",
        "devices": [{"deviceModelId": 405, "symptomDescription": "Pin tụt nhanh", "serviceItems": [{"serviceCatalogItemId": 1129}]}],
    })


APPOINTMENT_STATES = ("PENDING_CONFIRMATION", "CONFIRMED", "ARRIVED", "CANCELLED", "EXPIRED")


def seed_appointment_matrix(admin_token: str, receptionist_token: str):
    appointments = api("GET", "/api/v1/internal/appointments", token=receptionist_token)
    existing = {item["appointment"]["customerFullName"]: item["appointment"] for item in appointments}
    output = []
    now = datetime.now(VN)

    for index, state in enumerate(("PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED")):
        marker = f"Demo Appointment {state}"
        if marker in existing:
            output.append({"appointmentId": existing[marker]["id"], "status": existing[marker]["status"], "existing": True})
            continue
        start = (now + timedelta(days=1)).replace(hour=9 + index, minute=0, second=0, microsecond=0)
        slot = create_slot(1071, start, start + timedelta(minutes=30), admin_token)
        appointment = create_appointment(state, slot["slotId"])
        appointment_id = appointment["appointmentId"]
        if state == "CONFIRMED":
            api("POST", f"/api/v1/internal/appointments/{appointment_id}/confirm", {}, receptionist_token)
        elif state == "CANCELLED":
            api("POST", f"/api/v1/internal/appointments/{appointment_id}/cancel", {"reason": "Fixture demo deterministic"}, receptionist_token)
        output.append({"appointmentId": appointment_id, "status": state, "existing": False})

    # Short slots keep the script practical while still exercising the real transition guards.
    for offset, state in ((4, "ARRIVED"), (18, "EXPIRED")):
        marker = f"Demo Appointment {state}"
        if marker in existing:
            output.append({"appointmentId": existing[marker]["id"], "status": existing[marker]["status"], "existing": True})
            continue
        start = datetime.now(VN) + timedelta(seconds=offset)
        end = start + timedelta(seconds=8)
        slot = create_slot(1071, start, end, admin_token)
        appointment_id = create_appointment(state, slot["slotId"])["appointmentId"]
        if state == "ARRIVED":
            api("POST", f"/api/v1/internal/appointments/{appointment_id}/confirm", {}, receptionist_token)
            time.sleep(max(0, start.timestamp() - time.time()) + 1)
            api("POST", f"/api/v1/internal/appointments/{appointment_id}/arrive", {}, receptionist_token)
        else:
            time.sleep(max(0, end.timestamp() - time.time()) + 1)
            api("POST", f"/api/v1/internal/appointments/{appointment_id}/expire", {}, receptionist_token)
        output.append({"appointmentId": appointment_id, "status": state, "existing": False})
    return output


def seed_zero_amount_warranty(admin_token: str, receptionist_token: str, source_ticket_id: int):
    if OUTPUT.exists():
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
        previous_warranty = previous.get("zeroAmountWarranty")
        if previous_warranty:
            detail = api("GET", f"/api/v1/internal/service-tickets/{previous_warranty['ticketId']}", token=receptionist_token)
            if detail["ticket"]["status"] == "HANDED_OVER":
                return {**previous_warranty, "existing": True}

    source = api("GET", f"/api/v1/internal/service-tickets/{source_ticket_id}", token=receptionist_token)
    source_item = source["repairItems"][0]
    history_path = "/api/v1/internal/warranty-history?" + urllib.parse.urlencode({"ticketCode": source["ticket"]["ticketCode"]})
    history = api("GET", history_path, token=receptionist_token)
    history_item = next((item for item in history["items"] if item["repairItemId"] == source_item["id"]), None)
    prior_claim = history_item["claims"][-1] if history_item and history_item["claims"] else None
    if prior_claim and prior_claim["status"] == "HANDED_OVER":
        return {
            "ticketId": prior_claim["ticketId"], "sourceTicketId": source_ticket_id, "status": "HANDED_OVER",
            "warrantyDecision": "APPROVED", "warrantyRemedy": "REPAIR", "settledAmount": 0, "existing": True,
        }
    if prior_claim:
        ticket_id = prior_claim["ticketId"]
        claim = api("GET", f"/api/v1/internal/service-tickets/{ticket_id}", token=receptionist_token)
    else:
        claim = api("POST", f"/api/v1/internal/repair-items/{source_item['id']}/warranty-claims", {
            "branchId": source["ticket"]["branchId"],
            "serviceCatalogItemId": 1129,
            "receivedCondition": "Fixture bảo hành miễn phí trong demo DB",
            "customerReportedIssue": "Thiết bị phát sinh lại lỗi thuộc phạm vi bảo hành",
            "note": "Fixture deterministic cho settle-zero",
            "authorizedScope": "Kiểm tra và sửa lỗi trong phạm vi bảo hành",
        }, receptionist_token)
        ticket_id = claim["ticket"]["id"]
    users = api("GET", "/api/v1/admin/users", token=admin_token)
    users_by_id = {user["id"]: user for user in users}
    ticket_status = claim["ticket"]["status"]
    if ticket_status == "WAITING_ASSIGNMENT":
        _, technician_token = assign(ticket_id, receptionist_token, users_by_id, set())
        ticket_status = "ASSIGNED"
    else:
        operational = api("GET", "/api/v1/internal/service-tickets?" + urllib.parse.urlencode({"query": claim["ticket"]["ticketCode"]}), token=receptionist_token)
        active_technician_id = next(item["activeTechnicianId"] for item in operational if item["ticketId"] == ticket_id)
        technician_token = login(users_by_id[active_technician_id]["username"], TECHNICIAN_PASSWORD)
    if ticket_status == "ASSIGNED":
        api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/inspection/start", {}, technician_token)
    detail = api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/inspection", {
        "inspectionResult": "Xác nhận lỗi thuộc phạm vi bảo hành",
        "requiresCustomerApproval": False,
        "confirmationMethod": "DIRECT",
        "confirmationNote": "Khách xác nhận phương án sửa bảo hành",
        "items": [{
            "serviceCatalogItemId": 1129, "basePrice": 0, "finalPrice": 0,
            "warrantySourceItemId": source_item["id"],
        }],
    }, technician_token)
    warranty_item = next(item for item in detail["repairItems"] if item["warrantySourceItemId"] == source_item["id"])
    if warranty_item["warrantyDecision"] is None:
        api("POST", f"/api/v1/internal/repair-items/{warranty_item['id']}/warranty-decision", {
            "decision": "APPROVED", "note": "Lỗi hợp lệ trong thời hạn bảo hành",
            "remedy": "REPAIR", "replacementCatalogItemId": None,
        }, technician_token)
    api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/finish-repair", {}, technician_token)
    settlement = api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/payment/settle-zero", {}, receptionist_token)
    api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/handover", {}, receptionist_token)
    return {
        "ticketId": ticket_id, "sourceTicketId": source_ticket_id, "status": "HANDED_OVER",
        "warrantyDecision": "APPROVED", "warrantyRemedy": "REPAIR",
        "settledAmount": settlement["totalAmount"], "existing": False,
    }


def main():
    admin_token = login("admin", ADMIN_PASSWORD)
    receptionist_token = login("reception01", RECEPTIONIST_PASSWORD)
    tickets = seed_ticket_matrix(admin_token, receptionist_token)
    handed_over_id = next(item["ticketId"] for item in tickets if item["status"] == "HANDED_OVER")
    result = {
        "generatedAt": datetime.now(VN).isoformat(),
        "target": BASE_URL,
        "isolatedDemoOnly": True,
        "tickets": tickets,
        "appointments": seed_appointment_matrix(admin_token, receptionist_token),
        "zeroAmountWarranty": seed_zero_amount_warranty(admin_token, receptionist_token, handed_over_id),
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
