"""
Patient Health & Biomarkers Router
Provides endpoints for preventive health analytics and AI doctor briefings.
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import get_current_user
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/patient/biomarkers", tags=["Patient Health"])


class DoctorBriefingRequest(BaseModel):
    specialty_type: str = Field(..., json_schema_extra={"example": "Cardiology"})
    target_patient_id: Optional[str] = None


@router.get("/matrix")
async def get_biomarker_matrix(
    patient_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """
    Fetch historical time-series biomarkers and risk score for the patient.
    """
    if not patient_id or not isinstance(patient_id, str):
        account_id = user.get("sub")
    else:
        account_id = patient_id
    
    try:
        db_rows = _rows(
            supabase.table("patient_biomarkers")
            .select("*")
            .eq("patient_id", account_id)
            .order("recorded_at", desc=True)
            .execute()
        )
    except Exception as exc:
        logger.warning(f"Error querying patient_biomarkers table: {exc}")
        db_rows = []

    biomarkers = db_rows
    risk_compass = _build_risk_compass(db_rows) if db_rows else None

    return {
        "patient_id": account_id,
        "biomarkers": biomarkers,
        "risk_compass": risk_compass
    }


def _build_risk_compass(rows: List[dict]) -> dict:
    """Summarize real biomarker readings — no clinical risk score is computed
    here since CallMedex has no doctor-reviewed interpretation model yet
    (see CLAUDE.md Clinical Liability Firewall). Only factual, directly
    observable data goes in this response."""
    latest_by_code: dict = {}
    for row in rows:  # rows are already ordered by recorded_at desc
        code = row.get("observation_code")
        latest_by_code.setdefault(code, []).append(row)

    trends = []
    for code, readings in latest_by_code.items():
        latest = readings[0]
        direction = "flat"
        if len(readings) > 1:
            prev_value = readings[1].get("value_number")
            latest_value = latest.get("value_number")
            if prev_value is not None and latest_value is not None:
                if latest_value > prev_value:
                    direction = "up"
                elif latest_value < prev_value:
                    direction = "down"
        trends.append({
            "observation_code": code,
            "observation_name": latest.get("observation_name"),
            "latest_value": latest.get("value_number"),
            "unit": latest.get("unit"),
            "recorded_at": latest.get("recorded_at"),
            "direction": direction,
        })

    return {
        "total_readings": len(rows),
        "distinct_biomarkers": len(latest_by_code),
        "latest_recorded_at": rows[0].get("recorded_at"),
        "trends": trends,
        "summary_text": (
            f"{len(rows)} lab reading(s) on file across {len(latest_by_code)} biomarker(s). "
            "Clinical risk interpretation requires doctor review."
        ),
    }


def _build_doctor_briefing_content(patient_id: Optional[str], specialty: str, biomarker_rows: List[dict], medication_rows: List[dict]) -> dict:
    """Compile a briefing from real records only — no invented anomalies or
    risk narrative (see CLAUDE.md Clinical Liability Firewall)."""
    compass = _build_risk_compass(biomarker_rows) if biomarker_rows else None
    recorded_dates = {row.get("recorded_at") for row in biomarker_rows}

    chief_anomalies = []
    focus_points = []
    if compass:
        for trend in compass["trends"]:
            if trend["direction"] in ("up", "down"):
                chief_anomalies.append(
                    f"{trend['observation_name']} trending {trend['direction']}: "
                    f"{trend['latest_value']} {trend['unit']} (recorded {trend['recorded_at']})"
                )
                focus_points.append(f"Review {trend['observation_name']} trend with patient.")

    if medication_rows:
        focus_points.append(f"Confirm adherence for {len(medication_rows)} active medication(s) on file.")

    if not chief_anomalies and not medication_rows:
        focus_points.append("No lab or medication data on file yet — request updated records before this consultation.")

    return {
        "specialty_type": specialty,
        "patient_id": patient_id,
        "compiled_at": datetime.now(timezone.utc).isoformat(),
        "chief_anomalies": chief_anomalies,
        "active_medications_count": len(medication_rows),
        "recent_report_count": len(recorded_dates),
        "risk_summary": (
            "No automated clinical risk score is generated — CallMedex surfaces raw trends only. "
            f"Clinical assessment relevant to {specialty} requires doctor review."
        ),
        "recommended_focus_points": focus_points,
    }


@router.post("/doctor-briefing")
async def generate_doctor_briefing(
    payload: DoctorBriefingRequest,
    user: dict = Depends(get_current_user)
):
    """
    Compile active medications and lab-observation trends into a specialty-tailored briefing.
    Decision-support only — not a diagnosis; requires doctor sign-off.
    """
    patient_id = payload.target_patient_id or user.get("sub")
    specialty = payload.specialty_type

    try:
        biomarker_rows = _rows(
            supabase.table("patient_biomarkers")
            .select("*")
            .eq("patient_id", patient_id)
            .order("recorded_at", desc=True)
            .execute()
        )
    except Exception as exc:
        logger.warning(f"Error querying patient_biomarkers table: {exc}")
        biomarker_rows = []

    try:
        medication_rows = _rows(
            supabase.table("patient_medications")
            .select("*")
            .eq("patient_id", patient_id)
            .execute()
        )
    except Exception as exc:
        logger.warning(f"Error querying patient_medications table: {exc}")
        medication_rows = []

    briefing_content = _build_doctor_briefing_content(patient_id, specialty, biomarker_rows, medication_rows)

    # Attempt to cache briefing in PostgreSQL DB
    try:
        supabase.table("doctor_briefings").insert({
            "patient_id": patient_id,
            "specialty_type": specialty,
            "summary_json": briefing_content
        }).execute()
    except Exception as exc:
        logger.warning(f"Could not persist doctor briefing to DB: {exc}")

    return {
        "status": "success",
        "briefing": briefing_content
    }
