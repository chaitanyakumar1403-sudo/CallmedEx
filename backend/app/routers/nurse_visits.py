"""
Home Nursing Visits & Clinical Documentation Router (§5.6 & §12.1)
Captures home vitals, wound care notes, IV infusion records, and nursing procedures.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import get_current_user
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nurse/visits", tags=["Home Nursing Visits (§5.6)"])


class NurseVitalsLogRequest(BaseModel):
    vitals: Dict[str, Any] = Field(
        default={},
        description="Recorded patient vitals: bp_systolic, bp_diastolic, heart_rate, spo2, temperature_f, blood_glucose"
    )
    wound_care_notes: Optional[str] = None
    iv_logs: Optional[Dict[str, Any]] = None
    procedure_notes: Optional[str] = None
    attachment_url: Optional[str] = None


def _require_visit_party(booking: dict, user_id: str, role: str, action: str) -> None:
    """Assert the caller is actually attached to this visit.

    Holding the role "nurse" is not authorisation for a *particular* patient's
    visit — every nurse on the platform holds it. Clinical vitals, wound notes
    and IV logs are PHI, so membership is checked per booking: the assigned
    provider, the patient themselves, or an admin. Anyone else is refused
    regardless of role.
    """
    if role == "admin":
        return
    assigned = (booking.get("assigned_nurse_id"), booking.get("assigned_provider_id"))
    if user_id in assigned or user_id == booking.get("patient_id"):
        return
    raise HTTPException(403, f"Not authorized to {action} this visit.")


def _load_visit_booking(booking_id: str) -> dict:
    rows = _rows(
        supabase.table("bookings")
        .select("id, patient_id, assigned_nurse_id, assigned_provider_id, status")
        .eq("id", booking_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise HTTPException(404, "Nursing booking not found.")
    return rows[0]


@router.post("/{booking_id}/vitals")
async def record_nurse_visit_vitals(
    booking_id: str,
    payload: NurseVitalsLogRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Record clinical vitals and care log for a home nursing visit.
    Accessible by assigned nurse, provider, or admin.
    """
    if not supabase:
        raise HTTPException(500, "Database unavailable.")

    nurse_id = current_user["sub"]
    role = current_user.get("role") or ""

    booking = _load_visit_booking(booking_id)
    patient_id = booking.get("patient_id")

    _require_visit_party(booking, nurse_id, role, "log vitals for")

    now = datetime.now(timezone.utc).isoformat()

    try:
        ins = supabase.table("nurse_visit_logs").insert({
            "booking_id": booking_id,
            "patient_id": patient_id,
            "nurse_id": nurse_id,
            "vitals": payload.vitals,
            "wound_care_notes": payload.wound_care_notes,
            "iv_logs": payload.iv_logs,
            "procedure_notes": payload.procedure_notes,
            "attachment_url": payload.attachment_url,
            "created_at": now,
        }).execute()
        log_id = ins.data[0]["id"] if ins.data else None
    except Exception as exc:
        logger.error(f"Failed to record nurse visit log: {exc}")
        raise HTTPException(500, "Failed to save visit vitals.")

    # Also extract blood pressure / heart rate / glucose into patient_biomarkers if provided
    v = payload.vitals or {}
    if patient_id:
        biomarker_entries = []
        if v.get("spo2"):
            biomarker_entries.append({"code": "SPO2", "name": "Oxygen Saturation (SpO2)", "val": float(v["spo2"]), "unit": "%"})
        if v.get("heart_rate") or v.get("pulse"):
            biomarker_entries.append({"code": "HEART_RATE", "name": "Pulse Rate", "val": float(v.get("heart_rate") or v.get("pulse")), "unit": "bpm"})
        if v.get("blood_glucose"):
            biomarker_entries.append({"code": "GLUCOSE_RANDOM", "name": "Random Blood Glucose", "val": float(v["blood_glucose"]), "unit": "mg/dL"})

        for be in biomarker_entries:
            try:
                supabase.table("patient_biomarkers").insert({
                    "patient_id": patient_id,
                    "observation_code": be["code"],
                    "observation_name": be["name"],
                    "value_number": be["val"],
                    "unit": be["unit"],
                    "recorded_at": now,
                }).execute()
            except Exception:
                pass

    return {
        "success": True,
        "log_id": log_id,
        "booking_id": booking_id,
        "message": "Nursing vitals and procedure documentation logged successfully.",
    }


@router.get("/{booking_id}/logs")
async def get_nurse_visit_logs(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Retrieve clinical logs and vitals history for a nursing visit.
    """
    if not supabase:
        return {"success": True, "logs": []}

    # Vitals, wound notes and IV logs are PHI. This read was previously open to
    # any authenticated account holding a booking id.
    _require_visit_party(
        _load_visit_booking(booking_id),
        current_user["sub"],
        current_user.get("role") or "",
        "view clinical logs for",
    )

    try:
        logs = _rows(
            supabase.table("nurse_visit_logs")
            .select("*")
            .eq("booking_id", booking_id)
            .order("created_at", desc=True)
            .execute()
        )
        return {"success": True, "logs": logs, "count": len(logs)}
    except Exception as exc:
        logger.error(f"get_nurse_visit_logs failed: {exc}")
        return {"success": True, "logs": []}
