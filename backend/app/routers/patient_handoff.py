"""
Doctor Handoff QR & Retest Radar Router (§8.3 & §8.9)
Provides 15-minute consent-backed FHIR R4 handoff packets for clinic consultations,
and longitudinal biomarker retest reminders.
"""
import logging
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import get_current_user
from app.services.magic_link import MagicLinkService
from app.services.fhir import FHIRService
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Doctor Handoff & Radar"])


class HandoffRequest(BaseModel):
    scopes: List[str] = Field(
        default=["vitals", "medications", "abnormal_biomarkers", "recent_reports", "doctor_briefing"],
        description="Patient-consented data scopes for doctor handoff"
    )
    notes: Optional[str] = None


@router.post("/patient/handoff")
async def create_doctor_handoff(
    payload: HandoffRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Doctor Handoff QR (§8.3):
    Generates a 15-minute encrypted handoff token that provides zero-app-install
    clinical briefing to any doctor or hospital desk scanning the QR code.
    Logs explicit patient consent into consent_records.
    """
    if not supabase:
        raise HTTPException(500, "Database unavailable.")

    patient_id = current_user["sub"]

    # Generate 15-minute token
    token = MagicLinkService.generate_handoff_token(
        patient_id=patient_id,
        scopes=payload.scopes,
        expiration_minutes=15
    )

    # Log to DPDP consent_records
    try:
        supabase.table("consent_records").insert({
            "patient_id": patient_id,
            "consent_type": "doctor_handoff_qr",
            "purpose": "15-minute clinic consultation handoff of vital observations & medications",
            "granted_to": "scanning_physician",
            "granted_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": datetime.fromtimestamp(time.time() + 900, tz=timezone.utc).isoformat(),
            "is_active": True,
        }).execute()
    except Exception as exc:
        logger.warning(f"Could not persist consent_record for handoff: {exc}")

    return {
        "success": True,
        "token": token,
        "share_url": f"/handoff/{token}",
        "expires_in_minutes": 15,
        "scopes": payload.scopes,
        "message": "Handoff QR packet created. Valid for 15 minutes.",
    }


@router.get("/handoff/{token}")
async def get_public_doctor_handoff(token: str, request: Request, format: Optional[str] = None):
    """
    Public Doctor Handoff viewer (§8.3).
    Accessed by doctors scanning the patient's screen in clinic.
    Returns:
    - Structured FHIR R4 Bundle + Clinical Briefing
    - Clean rendered HTML card if format=html or Accept: text/html
    """
    payload = MagicLinkService.decode_handoff_token(token)
    if not payload:
        raise HTTPException(401, "Doctor Handoff packet has expired or is invalid (15-minute limit).")

    patient_id = payload.get("patient_id")
    scopes = payload.get("scopes", [])

    if not supabase or not patient_id:
        raise HTTPException(404, "Patient record unavailable.")

    # 1. Fetch Patient basic demographic
    patient_info = {}
    try:
        u_rows = _rows(supabase.table("users").select("id, full_name, gender, date_of_birth, mobile").eq("id", patient_id).limit(1).execute())
        if u_rows:
            patient_info = u_rows[0]
    except Exception:
        pass

    # 2. Fetch Active Medications
    medications = []
    if "medications" in scopes:
        try:
            medications = _rows(
                supabase.table("patient_medications")
                .select("medicine_name, dosage, pills_per_day, remaining_pills, refill_date")
                .eq("patient_id", patient_id)
                .execute()
            )
        except Exception:
            medications = []

    # 3. Fetch Recent Lab Biomarkers
    biomarkers = []
    if "abnormal_biomarkers" in scopes or "vitals" in scopes:
        try:
            biomarkers = _rows(
                supabase.table("patient_biomarkers")
                .select("observation_code, observation_name, value_number, unit, recorded_at")
                .eq("patient_id", patient_id)
                .order("recorded_at", desc=True)
                .limit(20)
                .execute()
            )
        except Exception:
            biomarkers = []

    # 4. Fetch Doctor Briefing
    briefing = None
    if "doctor_briefing" in scopes:
        try:
            b_rows = _rows(
                supabase.table("doctor_briefings")
                .select("specialty_type, summary_json, created_at")
                .eq("patient_id", patient_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if b_rows:
                briefing = b_rows[0].get("summary_json")
        except Exception:
            briefing = None

    # Construct FHIR R4 Bundle
    fhir_bundle = {
        "resourceType": "Bundle",
        "type": "document",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": patient_id,
                    "name": [{"text": patient_info.get("full_name", "Patient")}],
                    "gender": patient_info.get("gender", "unknown"),
                    "birthDate": patient_info.get("date_of_birth"),
                }
            }
        ]
    }

    for bm in biomarkers:
        fhir_bundle["entry"].append({
            "resource": {
                "resourceType": "Observation",
                "status": "final",
                "code": {
                    "coding": [{"system": "http://loinc.org", "code": bm.get("observation_code"), "display": bm.get("observation_name")}],
                    "text": bm.get("observation_name")
                },
                "valueQuantity": {
                    "value": float(bm.get("value_number", 0)),
                    "unit": bm.get("unit"),
                },
                "effectiveDateTime": bm.get("recorded_at")
            }
        })

    for med in medications:
        fhir_bundle["entry"].append({
            "resource": {
                "resourceType": "MedicationStatement",
                "status": "active",
                "medicationCodeableConcept": {"text": med.get("medicine_name")},
                "dosage": [{"text": f"{med.get('dosage')} - {med.get('pills_per_day')} pill(s)/day"}]
            }
        })

    # If HTML requested, render clean print-ready clinical card
    accept = request.headers.get("accept", "")
    if format == "html" or "text/html" in accept:
        meds_html = "".join(f"<li><strong>{m.get('medicine_name')}</strong> — {m.get('dosage')} ({m.get('pills_per_day')}x daily)</li>" for m in medications) or "<li>No active medications on file</li>"
        bms_html = "".join(f"<tr><td style='padding:6px 12px;border-bottom:1px solid #e2e8f0'>{b.get('observation_name')}</td><td style='padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:600'>{b.get('value_number')} {b.get('unit')}</td><td style='padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#64748b'>{b.get('recorded_at', '')[:10]}</td></tr>" for b in biomarkers) or "<tr><td colspan='3' style='padding:12px;color:#64748b'>No recent lab readings recorded</td></tr>"

        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>CallMedex Doctor Handoff — {patient_info.get('full_name', 'Patient')}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1528; color: #f8fafc; margin: 0; padding: 24px; }}
        .container {{ max-width: 680px; margin: 0 auto; background: #132238; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }}
        .badge {{ display: inline-block; padding: 4px 10px; background: rgba(59,130,246,0.2); color: #60a5fa; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }}
        h1 {{ font-size: 22px; margin: 12px 0 4px; color: #fff; }}
        p.sub {{ color: #94a3b8; font-size: 14px; margin-top: 0; }}
        h2 {{ font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-top: 24px; color: #38bdf8; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }}
        ul {{ padding-left: 20px; font-size: 14px; color: #cbd5e1; line-height: 1.6; }}
        .footer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #64748b; text-align: center; }}
    </style>
</head>
<body>
    <div class="container">
        <span class="badge">Verified Doctor Handoff</span>
        <h1>{patient_info.get('full_name', 'Patient Records')}</h1>
        <p class="sub">Valid for 15 minutes &bull; ABDM Compliant &bull; FHIR R4</p>
        
        <h2>Active Medications</h2>
        <ul>{meds_html}</ul>

        <h2>Recent Observations & Lab Trends</h2>
        <table>
            <thead>
                <tr style="text-align:left; color:#94a3b8; font-size:12px;">
                    <th style="padding:6px 12px;">Biomarker</th>
                    <th style="padding:6px 12px;">Reading</th>
                    <th style="padding:6px 12px;">Date</th>
                </tr>
            </thead>
            <tbody>{bms_html}</tbody>
        </table>

        <div class="footer">
            CallMedex Clinical Platform &bull; DPDP & ABDM Protected &bull; Token Expiring Soon
        </div>
    </div>
</body>
</html>"""
        return HTMLResponse(content=html_content)

    return {
        "success": True,
        "patient": {
            "name": patient_info.get("full_name"),
            "gender": patient_info.get("gender"),
            "dob": patient_info.get("date_of_birth"),
        },
        "medications": medications,
        "biomarkers": biomarkers,
        "briefing": briefing,
        "fhir_bundle": fhir_bundle,
    }


@router.get("/patient/retest-radar")
async def get_patient_retest_radar(current_user: dict = Depends(get_current_user)):
    """
    Retest Radar (§8.9):
    Cross-references patient's historical lab tests against clinical guidelines
    in biomarker_retest_rules. Surfaces gentle retest suggestions with trendlines
    and suggested home booking services.
    """
    if not supabase:
        raise HTTPException(500, "Database unavailable.")

    patient_id = current_user["sub"]

    # 1. Fetch latest biomarker readings for patient
    bm_rows = _rows(
        supabase.table("patient_biomarkers")
        .select("*")
        .eq("patient_id", patient_id)
        .order("recorded_at", desc=True)
        .execute()
    )

    # 2. Fetch retest rules
    rules = _rows(
        supabase.table("biomarker_retest_rules")
        .select("*")
        .execute()
    )

    if not rules:
        # Fallback default rules if table not seeded
        rules = [
            {"biomarker_type": "VITAMIN_D", "interval_days": 90, "clinical_rationale": "Monitor 25-OH Vitamin D after supplementation."},
            {"biomarker_type": "HBA1C", "interval_days": 90, "clinical_rationale": "HbA1c reflects 3-month glycemic control."},
            {"biomarker_type": "LIPID_PROFILE", "interval_days": 180, "clinical_rationale": "Follow up fasting lipid levels every 6 months."},
            {"biomarker_type": "THYROID_TSH", "interval_days": 60, "clinical_rationale": "TSH steady-state check after dosage adjustment."},
        ]

    # Map biomarkers by observation_code
    latest_by_code: Dict[str, dict] = {}
    history_by_code: Dict[str, List[dict]] = {}
    for r in bm_rows:
        code = (r.get("observation_code") or "").upper()
        if code not in latest_by_code:
            latest_by_code[code] = r
        history_by_code.setdefault(code, []).append(r)

    recommendations = []
    now = datetime.now(timezone.utc)

    for rule in rules:
        b_type = (rule.get("biomarker_type") or "").upper()
        # Find matching latest reading
        matched_code = None
        for code in latest_by_code:
            if b_type in code or code in b_type:
                matched_code = code
                break

        if not matched_code:
            continue

        latest = latest_by_code[matched_code]
        try:
            recorded_dt = datetime.fromisoformat(latest["recorded_at"].replace("Z", "+00:00"))
            days_elapsed = (now - recorded_dt).days
        except Exception:
            days_elapsed = 999

        interval_days = int(rule.get("interval_days", 90))
        is_due = days_elapsed >= interval_days
        days_until_due = max(0, interval_days - days_elapsed)

        # Build sparkline points
        history = history_by_code.get(matched_code, [])[:5]
        history.reverse()
        sparkline = [float(h.get("value_number", 0)) for h in history]

        recommendations.append({
            "biomarker_code": matched_code,
            "biomarker_name": latest.get("observation_name", b_type),
            "latest_value": latest.get("value_number"),
            "unit": latest.get("unit", ""),
            "last_tested_at": latest.get("recorded_at"),
            "days_elapsed": days_elapsed,
            "interval_days": interval_days,
            "is_due": is_due,
            "days_until_due": days_until_due,
            "clinical_rationale": rule.get("clinical_rationale", "Follow-up recommended by clinical guideline."),
            "trend": sparkline,
            "suggested_service_id": rule.get("suggested_service_id"),
        })

    # Sort so due items appear first
    recommendations.sort(key=lambda x: (not x["is_due"], x["days_until_due"]))

    return {
        "success": True,
        "recommendations": recommendations,
        "count": len(recommendations),
        "summary": f"{sum(1 for r in recommendations if r['is_due'])} test(s) due for routine clinical re-evaluation.",
    }
