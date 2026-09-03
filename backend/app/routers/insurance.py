"""
Insurance & NHCX Router (Phase 4)
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.middleware.auth import get_current_user
from app.config import settings
from app.database import supabase
from app.services.nhcx import NHCXService
import uuid


def require_nhcx_enabled() -> None:
    """Refuse to answer while NHCX is still scaffolding.

    NHCXService reports the same "Star Health (AB-PMJAY), Rs 5,00,000, Active"
    for any ABHA of five characters or more, and claim submission writes a mock
    insurer name and an invented transaction id into insurance_claims while
    answering "Claim submitted to NHCX successfully."

    A patient acting on that could arrive expecting cashless cover that does
    not exist, so the whole router stays closed until ENABLE_NHCX_INSURANCE is
    set against a real NHCX integration.
    """
    if not settings.ENABLE_NHCX_INSURANCE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Insurance eligibility and claims are not available yet. "
                "CallMedex is not connected to NHCX."
            ),
        )


router = APIRouter(
    prefix="/api/insurance",
    tags=["Insurance Phase 4"],
    dependencies=[Depends(require_nhcx_enabled)],
)

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
        # A claim is only meaningful against the patient's real ABHA. This
        # previously persisted a literal "fake-abha-1234" into the claims table
        # beside a real amount and a real FHIR bundle — a fabricated national
        # health identifier written into a financial-medical record. Refuse
        # instead: a claim that cannot be filed is recoverable, a claim filed
        # against an invented health ID is not.
        patient = (
            supabase.table("patients")
            .select("abha_number")
            .eq("user_id", current_user["sub"])
            .limit(1)
            .execute()
        )
        rows = patient.data or []
        row: dict = rows[0] if rows and isinstance(rows[0], dict) else {}
        abha_number = (row.get("abha_number") or "").strip()
        if not abha_number:
            raise HTTPException(
                status_code=422,
                detail=(
                    "No ABHA number is linked to this patient, so an insurance "
                    "claim cannot be submitted. Link an ABHA account first."
                ),
            )

        data = {
            "id": claim_id,
            "patient_id": current_user["sub"],
            "booking_id": req.booking_id,
            "abha_number": abha_number,
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
