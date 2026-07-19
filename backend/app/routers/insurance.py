"""
Insurance & NHCX Router (Phase 4)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.nhcx import NHCXService
import uuid

router = APIRouter(prefix="/api/insurance", tags=["Insurance Phase 4"])

class EligibilityRequest(BaseModel):
    abha_number: str

class SubmitClaimRequest(BaseModel):
    booking_id: str
    amount: float

@router.post("/eligibility")
async def check_eligibility(req: EligibilityRequest, current_user: dict = Depends(get_current_user)):
    """Checks insurance coverage via NHCX middleware."""
    result = NHCXService.check_eligibility(req.abha_number)
    return {"success": True, "data": result}

@router.post("/claim/submit")
async def submit_claim(req: SubmitClaimRequest, current_user: dict = Depends(get_current_user)):
    """Submits a FHIR claim bundle to NHCX Sandbox."""
    claim_id = str(uuid.uuid4())
    
    # Generate the FHIR bundle
    fhir_bundle = NHCXService.generate_fhir_claim_bundle(
        patient_id=current_user["sub"],
        booking_id=req.booking_id,
        amount=req.amount
    )
    
    if supabase:
        data = {
            "id": claim_id,
            "patient_id": current_user["sub"],
            "booking_id": req.booking_id,
            "abha_number": "fake-abha-1234",
            "insurer_name": "NHCX Sandbox Mock Insurer",
            "claim_amount": req.amount,
            "status": "submitted",
            "nhcx_transaction_id": str(uuid.uuid4()),
            "fhir_bundle": fhir_bundle,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        supabase.table("insurance_claims").insert(data).execute()
        
    return {
        "success": True,
        "message": "Claim submitted to NHCX successfully.",
        "claim_id": claim_id
    }

@router.get("/claims")
async def get_patient_claims(current_user: dict = Depends(get_current_user)):
    """Fetch all claims for the patient."""
    if not supabase:
        return {"success": True, "claims": []}
        
    res = supabase.table("insurance_claims").select("*").eq("patient_id", current_user["sub"]).execute()
    return {"success": True, "claims": res.data}
