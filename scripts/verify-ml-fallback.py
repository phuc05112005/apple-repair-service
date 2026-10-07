"""Verify Spring's recommendation fallback against the isolated Docker demo stack."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = os.getenv("DEMO_API_BASE_URL", "http://127.0.0.1:8088").rstrip("/")
OUTPUT = Path(os.getenv("FALLBACK_OUTPUT", "target/full-stack/ml-fallback.json"))

if BASE_URL != "http://127.0.0.1:8088" and os.getenv("ALLOW_NON_DEFAULT_DEMO_URL") != "true":
    raise SystemExit("Fallback verification is restricted to the isolated demo stack.")


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
        raise RuntimeError(f"{method} {path} returned {error.code}: {error.read().decode('utf-8', errors='replace')}") from error


def main():
    login = api("POST", "/api/v1/auth/login", {"username": "reception01", "password": "123456"})
    token = login["accessToken"]
    run = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).strftime("%H%M%S")
    ticket = api("POST", "/api/v1/internal/service-tickets/walk-in", {
        "customerFullName": f"Demo Fallback {run}", "phone": f"091{run}0",
        "branchId": 1070, "deviceModelId": 405, "serialNumber": f"FALLBACK-{run}",
        "storage": "128 GB", "receivedCondition": "Fixture fallback trong demo DB",
        "serviceCatalogItemIds": [1129], "customerReportedIssue": "Xác minh fallback khi ML dừng",
        "authorizedScope": "Chỉ dùng trong demo DB cách ly",
    }, token)
    ticket_id = ticket["ticket"]["id"]
    candidates = api("GET", f"/api/v1/internal/service-tickets/{ticket_id}/technician-recommendations", token=token)
    if not candidates or any(item["predictionSource"] != "STANDARD_DURATION_FALLBACK" for item in candidates):
        raise RuntimeError("Recommendation response did not use standard-duration fallback for every candidate.")
    eligible = next((item for item in candidates if item["eligible"] and item["estimatedCompletionAt"]), None)
    if not eligible or eligible["predictedTechnicalMinutes"] <= 0:
        raise RuntimeError("Fallback did not produce an assignable candidate with positive duration and ETA.")
    assignment = api("POST", f"/api/v1/internal/service-tickets/{ticket_id}/assignments", {
        "technicianId": eligible["technicianId"], "source": "MANUAL_OVERRIDE",
    }, token)
    result = {
        "verifiedAt": datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).isoformat(),
        "ticketId": ticket_id,
        "candidateCount": len(candidates),
        "allSources": sorted({item["predictionSource"] for item in candidates}),
        "predictedTechnicalMinutes": eligible["predictedTechnicalMinutes"],
        "estimatedStartAt": eligible["estimatedStartAt"],
        "estimatedCompletionAt": eligible["estimatedCompletionAt"],
        "assignmentId": assignment["id"],
        "assignmentStatus": assignment["status"],
        "manualSelection": True,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
