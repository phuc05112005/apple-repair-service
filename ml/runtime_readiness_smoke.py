#!/usr/bin/env python3
"""Exercise live, ready and model-info against configured read-only MySQL."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

ML_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ML_ROOT))
from runtime_api.app import create_app


def main() -> int:
    with TestClient(create_app()) as client:
        missing = client.post("/api/v1/repair-duration/predict-candidates", json={
            "ticketId": 999999999,
            "candidateTechnicianIds": [1],
            "evaluationTimestamp": datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).isoformat(),
        })
        result = {
            "live": client.get("/health/live").json(),
            "ready_status": client.get("/health/ready").status_code,
            "ready": client.get("/health/ready").json(),
            "model_info_status": client.get("/api/v1/model-info").status_code,
            "missing_ticket_status": missing.status_code,
            "missing_ticket_code": missing.json().get("error", {}).get("code"),
        }
    print(json.dumps(result, indent=2))
    return 0 if (result["ready_status"] == 200 and result["model_info_status"] == 200
                 and result["missing_ticket_status"] == 404
                 and result["missing_ticket_code"] == "TICKET_NOT_FOUND") else 2


if __name__ == "__main__":
    raise SystemExit(main())
