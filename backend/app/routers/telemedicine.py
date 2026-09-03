"""
Telemedicine Router (Phase 3 — Full Implementation)
Video consultation rooms, digital consent, e-prescription generation.
Endpoints for patients, doctors, and consultation lifecycle.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.telemedicine import TelemedicineService
from app.utils.db_helpers import _rows

router = APIRouter(prefix="/api/telemed", tags=["Telemedicine"])


# ─── Request Models ──────────────────────────────────────────────────────

# Provider roles that may open a consultation room on a patient's behalf.
# Dietitians and physiotherapists consult over the same rooms as doctors.
CONSULTING_PROVIDER_ROLES = {"doctor", "dietitian", "physiotherapist", "admin"}


class StartConsultationRequest(BaseModel):
    doctor_id: str
    booking_id: Optional[str] = None
    # Set when a provider opens the room. The provider is the caller, so the
    # patient has to be named explicitly — otherwise create_consultation
    # records the provider as their own patient and the real patient is never
    # attached to the consultation at all.
    patient_id: Optional[str] = None
    consent_given: bool = True


class FinalizeConsultationRequest(BaseModel):
    consultation_id: str
    raw_transcript: str


class EndConsultationRequest(BaseModel):
    consultation_id: str


async def _resolve_consult_patient(req: "StartConsultationRequest") -> str:
    """Work out which patient a provider-opened consultation is for.

    The provider dashboard routes to /consult/<id>, where <id> is a booking id
    from the appointment list or a patient id from the patient list — the page
    cannot tell which, so it sends the same value in both fields and we resolve
    it here. Refusing outright beats guessing: a consultation filed against the
    wrong patient contaminates their record with someone else's prescription.
    """
    if req.booking_id and supabase:
        rows = _rows(
            supabase.table("bookings")
            .select("patient_id")
            .eq("id", req.booking_id)
            .limit(1)
            .execute()
        )
        if rows and rows[0].get("patient_id"):
            return rows[0]["patient_id"]

    if req.patient_id and supabase:
        rows = _rows(
            supabase.table("users")
            .select("id, role")
            .eq("id", req.patient_id)
            .limit(1)
            .execute()
        )
        if rows and rows[0].get("role") == "patient":
            return rows[0]["id"]

    raise HTTPException(
        status_code=400,
        detail="Select a patient (or an existing booking) before starting the consultation.",
    )


async def _require_participant(consultation_id: str, current_user: dict) -> dict:
    """Load a consultation and assert the caller is its patient, its provider,
    or an admin. Returns the consultation row.

    Every write side of a consultation (pre-intake symptoms, transcript
    finalisation, ordering against the resulting prescription) previously took
    only a consultation_id, so any authenticated account could read back or
    overwrite someone else's clinical record by guessing one.
    """
    consultation = await TelemedicineService.get_consultation(consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    if current_user.get("role") == "admin":
        return consultation
    if current_user["sub"] not in (
        consultation.get("patient_id"),
        consultation.get("doctor_id"),
    ):
        raise HTTPException(status_code=403, detail="Access denied")
    return consultation


# ═══════════════════════════════════════════════════════════════════════════
# DOCTOR DISCOVERY
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/doctors")
async def list_available_doctors(
    specialization: Optional[str] = Query(None, description="Filter by specialization"),
):
    """List doctors available for video consultation."""
    doctors = await TelemedicineService.get_available_doctors(specialization)

    # No invented doctors. This previously returned six fabricated
    # practitioners with names, qualifications, fees and ratings whenever the
    # database had none, so a patient could book a video consultation with a
    # doctor who does not exist. An empty list is honest and the client can say
    # so; a plausible fake is not recoverable once someone has booked against it.

    return {"success": True, "doctors": doctors, "count": len(doctors)}


# ═══════════════════════════════════════════════════════════════════════════
# CONSULTATION LIFECYCLE
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/start")
async def start_consultation(
    req: StartConsultationRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Patient starts a video consultation.
    1. Validates NMC 2026 digital consent
    2. Creates consultation record
    3. Generates secure Jitsi room
    4. Returns room URL for embedding
    """
    if not req.consent_given:
        raise HTTPException(
            status_code=400,
            detail="Digital consent is mandatory under NMC 2026 guidelines.",
        )

    # Resolve who the patient actually is. When a provider opens the room the
    # caller is NOT the patient, so taking current_user blindly filed the
    # consultation with the provider as their own patient and left the real
    # patient with no record of the consult at all.
    role = current_user.get("role") or ""
    if role in CONSULTING_PROVIDER_ROLES:
        patient_id = await _resolve_consult_patient(req)
        doctor_id = req.doctor_id or current_user["sub"]
    else:
        patient_id = current_user["sub"]
        doctor_id = req.doctor_id

    if not doctor_id:
        raise HTTPException(status_code=400, detail="A provider must be selected for this consultation.")

    try:
        result = await TelemedicineService.create_consultation(
            patient_id=patient_id,
            doctor_id=doctor_id,
            booking_id=req.booking_id,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {
        "success": True,
        "consultation_id": result["consultation_id"],
        "video_url": result["video_url"],
        "room_name": result["room_name"],
        "message": "Digital consent captured. Video room created.",
    }


@router.get("/room/{consultation_id}")
async def get_room_details(
    consultation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get video room details for an existing consultation."""
    consultation = await TelemedicineService.get_consultation(consultation_id)

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    # Verify access
    user_id = current_user["sub"]
    if consultation.get("patient_id") != user_id and consultation.get("doctor_id") != user_id:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")

    return {
        "success": True,
        "consultation_id": consultation_id,
        "video_url": consultation.get("video_room_url"),
        "room_name": consultation.get("video_room_name"),
        "status": consultation.get("status"),
        "patient_id": consultation.get("patient_id"),
        "doctor_id": consultation.get("doctor_id"),
        "started_at": consultation.get("started_at"),
        "consent_timestamp": consultation.get("consent_timestamp"),
    }


@router.post("/join/{consultation_id}")
async def join_consultation(
    consultation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark that a user has joined the video room."""
    result = await TelemedicineService.join_room(consultation_id, current_user["sub"])

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))

    return result


@router.post("/end")
async def end_consultation(
    req: EndConsultationRequest,
    current_user: dict = Depends(get_current_user),
):
    """End an active consultation (can be called by patient or doctor)."""
    result = await TelemedicineService.end_consultation(
        consultation_id=req.consultation_id,
        ended_by=current_user["sub"],
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))

    return result


@router.post("/finalize")
async def finalize_consultation(
    req: FinalizeConsultationRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Doctor finalizes the call. AI generates the E-Prescription.
    This is called after the call ends, with the transcript.
    """
    # An e-prescription is a clinical artefact signed off by the treating
    # provider. Only that provider (or an admin) may generate one — the
    # patient must not be able to finalise their own consultation either.
    consultation = await _require_participant(req.consultation_id, current_user)
    if (
        current_user.get("role") != "admin"
        and consultation.get("doctor_id") != current_user["sub"]
    ):
        raise HTTPException(
            status_code=403,
            detail="Only the treating provider can finalize this consultation.",
        )

    result = await TelemedicineService.finalize_consultation(
        consultation_id=req.consultation_id,
        transcript=req.raw_transcript,
    )

    return {
        "success": True,
        "message": "Consultation finalized and E-Prescription generated",
        **result,
    }


# ═══════════════════════════════════════════════════════════════════════════
# HISTORY & QUERIES
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/history")
async def get_consultation_history(
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Get consultation history for the current user."""
    history = await TelemedicineService.get_consultation_history(
        user_id=current_user["sub"],
        role=current_user.get("role", "patient"),
        limit=limit,
    )
    return {"success": True, "consultations": history, "count": len(history)}


@router.get("/active")
async def get_active_consultations(
    current_user: dict = Depends(get_current_user),
):
    """Get active/waiting consultations for a consulting provider."""
    if current_user.get("role") not in CONSULTING_PROVIDER_ROLES:
        raise HTTPException(status_code=403, detail="Only consulting providers can view active consultations")

    consultations = await TelemedicineService.get_active_consultations(current_user["sub"])
    return {"success": True, "consultations": consultations, "count": len(consultations)}


@router.get("/{consultation_id}")
async def get_consultation_details(
    consultation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get full details of a consultation including AI analysis."""
    consultation = await TelemedicineService.get_consultation(consultation_id)

    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    user_id = current_user["sub"]
    if (
        consultation.get("patient_id") != user_id
        and consultation.get("doctor_id") != user_id
        and current_user.get("role") != "admin"
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    return {"success": True, "consultation": consultation}


# ═══════════════════════════════════════════════════════════════════════════
# DAILY.CO MEETING TOKENS, PRE-INTAKE & 1-CLICK DISPATCH
# ═══════════════════════════════════════════════════════════════════════════

class PreIntakeRequest(BaseModel):
    consultation_id: str
    symptoms: str
    duration: str
    pain_score: int = 5
    active_medications: Optional[str] = ""
    allergies: Optional[str] = ""


class OrderPrescribedRequest(BaseModel):
    consultation_id: str
    action_type: str  # 'pharmacy' or 'diagnostics'
    address: Optional[str] = "Patient Default Address"


@router.get("/{consultation_id}/meeting-token")
async def get_daily_meeting_token(
    consultation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns a Daily.co meeting token.
    Doctors get moderator privileges (is_owner: True), patients get attendee privileges.
    """
    consultation = await TelemedicineService.get_consultation(consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    # Same participant check as /room/{id} — a meeting token is a key to a live
    # medical consultation, so it must never be issued to a non-participant.
    user_id = current_user["sub"]
    if consultation.get("patient_id") != user_id and consultation.get("doctor_id") != user_id:
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Access denied")

    # Moderator privileges follow THIS consultation's doctor, not the caller's
    # role — an unrelated doctor must not get owner rights on someone's call.
    is_doctor = (consultation.get("doctor_id") == user_id or current_user.get("role") == "admin")
    user_name = current_user.get("name") or ("Dr. Provider" if is_doctor else "Patient")
    room_name = consultation.get("video_room_name") or f"cmx-{consultation_id[:8]}"

    token = await TelemedicineService.generate_daily_meeting_token(
        room_name=room_name,
        user_name=user_name,
        is_doctor=is_doctor,
    )

    return {
        "success": True,
        "consultation_id": consultation_id,
        "room_name": room_name,
        "room_url": consultation.get("video_room_url"),
        "meeting_token": token,
        "is_doctor": is_doctor,
    }


@router.post("/pre-intake")
async def submit_pre_consultation_intake(
    req: PreIntakeRequest,
    current_user: dict = Depends(get_current_user),
):
    """Submit pre-call patient intake symptoms before video consultation."""
    await _require_participant(req.consultation_id, current_user)
    result = await TelemedicineService.submit_pre_intake(
        consultation_id=req.consultation_id,
        symptoms=req.symptoms,
        duration=req.duration,
        pain_score=req.pain_score,
        active_medications=req.active_medications or "",
        allergies=req.allergies or "",
    )
    return result


@router.post("/order-prescribed")
async def order_prescribed_actions(
    req: OrderPrescribedRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    1-Click Post-Consultation Action Dispatch:
    Order medicines directly to nearby pharmacy or dispatch phlebotomist for lab tests.
    """
    if req.action_type not in ("pharmacy", "diagnostics"):
        raise HTTPException(status_code=400, detail="action_type must be 'pharmacy' or 'diagnostics'.")

    # Order against the prescription on THIS consultation, for the patient it
    # was written for — not for whoever happens to hold the consultation id.
    consultation = await _require_participant(req.consultation_id, current_user)

    return await TelemedicineService.order_prescribed_actions(
        consultation_id=req.consultation_id,
        patient_id=consultation.get("patient_id") or current_user["sub"],
        action_type=req.action_type,
        address=req.address or "",
    )

