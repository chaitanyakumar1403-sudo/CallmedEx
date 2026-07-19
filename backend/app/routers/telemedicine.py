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

router = APIRouter(prefix="/api/telemed", tags=["Telemedicine"])


# ─── Request Models ──────────────────────────────────────────────────────

class StartConsultationRequest(BaseModel):
    doctor_id: str
    booking_id: Optional[str] = None
    consent_given: bool = True


class FinalizeConsultationRequest(BaseModel):
    consultation_id: str
    raw_transcript: str


class EndConsultationRequest(BaseModel):
    consultation_id: str


# ═══════════════════════════════════════════════════════════════════════════
# DOCTOR DISCOVERY
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/doctors")
async def list_available_doctors(
    specialization: Optional[str] = Query(None, description="Filter by specialization"),
    current_user: dict = Depends(get_current_user),
):
    """List doctors available for video consultation."""
    doctors = await TelemedicineService.get_available_doctors(specialization)

    # If no doctors from DB, return curated defaults for MVP
    if not doctors:
        doctors = [
            {
                "doctor_id": "demo-doc-1",
                "name": "Dr. Priya Sharma",
                "specialization": "General Medicine",
                "qualification": "MBBS, MD (Internal Medicine)",
                "experience_years": 12,
                "consultation_fee": 499,
                "languages": ["English", "Hindi", "Telugu"],
                "city": "Visakhapatnam",
                "available": True,
                "rating": 4.9,
            },
            {
                "doctor_id": "demo-doc-2",
                "name": "Dr. Rajesh Kumar",
                "specialization": "Cardiology",
                "qualification": "MBBS, DM (Cardiology)",
                "experience_years": 18,
                "consultation_fee": 799,
                "languages": ["English", "Hindi"],
                "city": "Hyderabad",
                "available": True,
                "rating": 4.8,
            },
            {
                "doctor_id": "demo-doc-3",
                "name": "Dr. Ananya Reddy",
                "specialization": "Dermatology",
                "qualification": "MBBS, MD (Dermatology)",
                "experience_years": 8,
                "consultation_fee": 599,
                "languages": ["English", "Telugu"],
                "city": "Visakhapatnam",
                "available": True,
                "rating": 4.7,
            },
            {
                "doctor_id": "demo-doc-4",
                "name": "Dr. Mohammed Irfan",
                "specialization": "Pediatrics",
                "qualification": "MBBS, MD (Pediatrics)",
                "experience_years": 10,
                "consultation_fee": 499,
                "languages": ["English", "Hindi", "Urdu"],
                "city": "Vijayawada",
                "available": True,
                "rating": 4.9,
            },
            {
                "doctor_id": "demo-doc-5",
                "name": "Dr. Lakshmi Devi",
                "specialization": "Gynecology",
                "qualification": "MBBS, MS (OBG)",
                "experience_years": 15,
                "consultation_fee": 699,
                "languages": ["English", "Telugu", "Hindi"],
                "city": "Visakhapatnam",
                "available": True,
                "rating": 4.8,
            },
            {
                "doctor_id": "demo-doc-6",
                "name": "Dr. Suresh Babu",
                "specialization": "Orthopedics",
                "qualification": "MBBS, MS (Ortho)",
                "experience_years": 20,
                "consultation_fee": 699,
                "languages": ["English", "Telugu"],
                "city": "Visakhapatnam",
                "available": True,
                "rating": 4.6,
            },
        ]

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

    result = await TelemedicineService.create_consultation(
        patient_id=current_user["sub"],
        doctor_id=req.doctor_id,
        booking_id=req.booking_id,
    )

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
    """Get active/waiting consultations for a doctor."""
    if current_user.get("role") not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Only doctors can view active consultations")

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
