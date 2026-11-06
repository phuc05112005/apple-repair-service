"""API FastAPI cho Spring Boot. GIỮ NGUYÊN endpoint và tên trường JSON; chỉ sửa nội dung cho đúng sự thật."""
import importlib
import sys
import traceback
from pathlib import Path
from typing import Any, Dict

import uvicorn
from fastapi import FastAPI, HTTPException

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.append(str(SCRIPT_DIR))

from config.config import FEATURE_CONTRACT_VERSION
from src.inference import load_bundle

db_service = importlib.import_module("scripts.06_db_service")
app = FastAPI(title="Apple Repair ML Engine", version="2.0.0")


def _first(payload: Dict[str, Any], *keys, default=None):
    for k in keys:
        if payload.get(k) not in (None, "", []):
            return payload[k]
    return default


@app.get("/health")
@app.get("/health/ready")
def health_check():
    try:
        md = load_bundle().metadata
        return {"status": "UP", "service": "Apple Repair ML Service", "modelVersion": md["model_version"]}
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/api/v1/model-info")
def model_info():
    """Thông tin minh bạch về model đang chạy (dùng cho trang quản trị/báo cáo)."""
    return load_bundle().metadata


@app.post("/api/v1/repair-duration/predict-candidates")
def predict_candidates(payload: Dict[str, Any]):
    try:
        ticket_id = _first(payload, "ticketId", "serviceTicketId", "service_ticket_id")
        candidates = _first(payload, "candidateTechnicianIds", "technicianIds", "candidates", default=[])
        if not ticket_id:
            raise HTTPException(status_code=400, detail="Thiếu ticketId trong request body")
        if not candidates:
            raise HTTPException(status_code=400, detail="Thiếu danh sách KTV ứng viên")

        preds = []
        for p in db_service.predict_candidates(int(ticket_id), [int(t) for t in candidates]):
            m = float(p["predicted_minutes"])
            preds.append({
                "technicianId": p["technician_id"], "technician_id": p["technician_id"],
                "predictedTechnicalMinutes": m, "predicted_technical_minutes": m,
                "predictedDurationMinutes": int(round(m)),
                "predictedLowerMinutes": p["lower_minutes"], "predictedUpperMinutes": p["upper_minutes"],
                "warnings": p["warnings"],
            })
        md = load_bundle().metadata
        return {
            "ticketId": int(ticket_id), "status": "SUCCESS", "predictions": preds, "candidates": preds,
            "model": {
                "name": md["model_name"], "version": md["model_version"], "status": "ACTIVE",
                "featureContractVersion": FEATURE_CONTRACT_VERSION,
                "syntheticData": md["synthetic_data"],        # nói thật: dữ liệu hiện là mô phỏng
                "productionValidated": False,                 # chưa đối chiếu với dữ liệu vận hành thật
                "testMaeMinutes": round(md["test_metrics"]["MAE"], 2),
                "intervalHalfWidthMinutes": round(md["interval_halfwidth_minutes"], 1),
            },
        }
    except HTTPException:
        raise
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/predict-and-update")
def predict_and_update(payload: Dict[str, Any]):
    ticket_id = _first(payload, "ticketId", "service_ticket_id", "serviceTicketId")
    if not ticket_id:
        raise HTTPException(status_code=400, detail="Thiếu ticketId")
    user_id = _first(payload, "userId", "user_id", default=1)
    if not db_service.process_and_update_ticket(int(ticket_id), int(user_id)):
        raise HTTPException(status_code=404, detail=f"Không tìm thấy phiếu #{ticket_id}")
    return {"status": "success", "serviceTicketId": ticket_id}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
