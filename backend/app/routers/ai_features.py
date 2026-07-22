"""
Phase 5 Router: AI Voice Triage & DrugShield API Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.middleware.auth import get_current_user
from app.services.ai_voice_scribe import AIVoiceScribeService
from app.services.drug_shield import DrugShieldService

router = APIRouter(prefix="/api/ai", tags=["AI Industry Features"])


class VoiceTriageRequest(BaseModel):
    transcript: str
    language: Optional[str] = "en"


class DrugVerifyRequest(BaseModel):
    medicine_name: str
    batch_number: Optional[str] = ""


@router.post("/voice-triage")
async def process_voice_triage(
    req: VoiceTriageRequest,
    current_user: dict = Depends(get_current_user),
):
    """Parses voice transcript into clinical urgency score & provider recommendation."""
    result = AIVoiceScribeService.process_voice_triage(
        transcript=req.transcript,
        language=req.language,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@router.post("/verify-drug")
async def verify_drug_shield(
    req: DrugVerifyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Verifies drug authenticity against CDSCO/BIS and calculates generic savings."""
    result = DrugShieldService.verify_medicine(
        query=req.medicine_name,
        batch_number=req.batch_number,
    )
    return result
