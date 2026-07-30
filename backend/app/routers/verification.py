"""
Verification Router — CallMedex Production Pipeline
Handles document upload and AI-powered verification for ALL provider roles:
  Doctors, Pharmacies, Phlebotomists, Organizations, Nurses.

Endpoints:
  POST /api/verification/verify-document  — Upload certificate + run full AI pipeline
  POST /api/verification/verify           — Legacy structural-only verification
  GET  /api/verification/status           — Check current verification status
"""
import json
import logging
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.models.schemas import APIResponse
from app.middleware.auth import get_current_user
from app.config import settings
from app.services.verification import VerificationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/verification", tags=["Verification"])

# Roles that can use the verification pipeline
VERIFIABLE_ROLES = {"doctor", "pharmacy", "phlebotomist", "organization", "nurse"}

# Maximum file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/jpg",
    "application/pdf",
}


@router.post("/verify-document", response_model=APIResponse)
async def verify_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a certificate/license image or PDF and run the full AI verification pipeline.

    Pipeline:
      1. AI OCR extraction (Gemini Vision)
      2. Strict matching against profile data (auto-reject on mismatch)
      3. Government API cross-check (NMC, Pharmacy Council, etc.)
      4. Immutable audit trail in the database

    Supported roles: doctor, pharmacy, phlebotomist, organization, nurse.
    Supported file types: JPEG, PNG, WEBP, PDF (max 10MB).
    """
    role = current_user.get("role", "")

    # Role guard
    if role not in VERIFIABLE_ROLES:
        raise HTTPException(
            status_code=403,
            detail=f"Document verification is not available for role: {role}. "
                   f"Only {', '.join(VERIFIABLE_ROLES)} can verify documents.",
        )

    # Gemini API guard
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured on the server. AI verification is unavailable.",
        )

    # File type validation
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. "
                   f"Please upload a JPEG, PNG, WEBP, or PDF file.",
        )

    # Read file
    try:
        file_bytes = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        raise HTTPException(status_code=400, detail="Failed to read the uploaded file.")

    # File size validation
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(file_bytes) / 1024 / 1024:.1f}MB). Maximum is 10MB.",
        )

    if len(file_bytes) < 1024:
        raise HTTPException(
            status_code=400,
            detail="File is too small. Please upload a valid certificate image or PDF.",
        )

    # Run the full AI pipeline
    try:
        result = await VerificationService.run_full_verification(
            user_id=current_user["sub"],
            role=role,
            file_bytes=file_bytes,
            mime_type=content_type,
        )

        status_code = 200
        if not result.get("success"):
            # Return 200 even for rejections so the frontend can display the reason
            # (HTTP errors should be reserved for server/request issues, not business logic)
            pass

        return APIResponse(
            success=result.get("success", False),
            message=result.get("message", "Verification completed."),
            data={
                "status": result.get("status"),
                "checks": result.get("checks", []),
                "source": result.get("source", ""),
            },
        )

    except ValueError as e:
        logger.error(f"Verification pipeline error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected verification error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during verification: {str(e)}",
        )


@router.post("/verify", response_model=APIResponse)
async def verify_structural(
    current_user: dict = Depends(get_current_user),
):
    """
    Legacy endpoint: Run structural-only verification (no document upload).
    Checks if the user has filled in all required fields.
    """
    role = current_user.get("role", "")
    if role not in VERIFIABLE_ROLES:
        raise HTTPException(status_code=403, detail="Not a verifiable role.")

    result = await VerificationService.run_verification(
        user_id=current_user["sub"],
        role=role,
    )

    return APIResponse(
        success=result.get("success", False),
        message=result.get("message", ""),
        data={
            "status": result.get("status"),
            "checks": result.get("checks", []),
            "source": result.get("source", ""),
        },
    )


@router.get("/status", response_model=APIResponse)
async def get_verification_status(
    current_user: dict = Depends(get_current_user),
):
    """
    Get the current verification status for the logged-in provider.
    Returns their status, all uploaded documents, and whether their profile is complete.
    """
    role = current_user.get("role", "")
    if role not in VERIFIABLE_ROLES:
        raise HTTPException(status_code=403, detail="Not a verifiable role.")

    result = await VerificationService.get_verification_status(
        user_id=current_user["sub"],
        role=role,
    )

    return APIResponse(
        success=True,
        message=f"Verification status for {role}",
        data=result,
    )


# ─── Aadhaar Verification ────────────────────────────────────────────────────

AADHAAR_REQUIRED_ROLES = {"doctor", "nurse", "phlebotomist"}


@router.post("/verify-aadhaar", response_model=APIResponse)
async def verify_aadhaar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload an Aadhaar card image for AI-based identity verification.
    Mandatory for: doctor, nurse, phlebotomist.

    Pipeline:
      1. AI OCR extraction of name, Aadhaar last-4, DOB from the card image
      2. Fuzzy name matching against user's registered full_name (threshold ≥ 0.80)
      3. Result stored in documents table as 'aadhaar_card' type
    """
    role = current_user.get("role", "")
    if role not in VERIFIABLE_ROLES:
        raise HTTPException(status_code=403, detail="Not a verifiable role.")

    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured.")

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    try:
        file_bytes = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read file.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB).")
    if len(file_bytes) < 1024:
        raise HTTPException(status_code=400, detail="File too small.")

    try:
        from app.services.ai_ocr import AadhaarOCRService, fuzzy_name_match
        from app.database import supabase

        # Run Aadhaar OCR
        ocr_result = AadhaarOCRService.extract_aadhaar_data(file_bytes, content_type)

        if not ocr_result.get("is_legible") or not ocr_result.get("is_valid_document"):
            # Store failed attempt
            if supabase:
                supabase.table("documents").insert({
                    "user_id": current_user["sub"],
                    "document_type": "aadhaar_card",
                    "verification_status": "rejected_illegible",
                    "ai_ocr_data": ocr_result,
                }).execute()

            return APIResponse(
                success=False,
                message=ocr_result.get("error", "Aadhaar card is not legible or not a valid document."),
                data={"status": "rejected", "ocr_result": ocr_result},
            )

        # Name matching against registered name
        registered_name = current_user.get("full_name", "")
        aadhaar_name = ocr_result.get("extracted_name", "")
        name_score = fuzzy_name_match(registered_name, aadhaar_name)

        checks = [
            {"check": "aadhaar_legible", "passed": True},
            {"check": "aadhaar_valid_document", "passed": True},
            {"check": "name_match", "passed": name_score >= 0.80,
             "detail": f"Registered: '{registered_name}', Aadhaar: '{aadhaar_name}', Score: {name_score:.2f}"},
        ]

        all_passed = all(c["passed"] for c in checks)
        status = "verified" if all_passed else "flagged_name_mismatch"

        # Store result
        if supabase:
            supabase.table("documents").insert({
                "user_id": current_user["sub"],
                "document_type": "aadhaar_card",
                "verification_status": status,
                "ai_ocr_data": ocr_result,
                "name_match_score": name_score,
            }).execute()

        return APIResponse(
            success=all_passed,
            message="Aadhaar verified successfully." if all_passed
                    else f"Name mismatch: Aadhaar says '{aadhaar_name}', registration says '{registered_name}'.",
            data={"status": status, "checks": checks, "name_score": name_score},
        )

    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Aadhaar verification error: {e}")
        raise HTTPException(status_code=500, detail=f"Aadhaar verification failed: {str(e)}")


# ─── Selfie / Liveness Verification ──────────────────────────────────────────

@router.post("/verify-selfie", response_model=APIResponse)
async def verify_selfie(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a selfie for AI-based liveness verification.
    Post-registration step (not blocking at signup).

    Checks:
      - Real photo (not screen capture / printout)
      - Single visible face
      - Well-lit and in focus
    """
    role = current_user.get("role", "")
    if role not in VERIFIABLE_ROLES:
        raise HTTPException(status_code=403, detail="Not a verifiable role.")

    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured.")

    content_type = (file.content_type or "").lower()
    image_types = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    if content_type not in image_types:
        raise HTTPException(status_code=400, detail="Selfie must be a JPEG, PNG, or WEBP image.")

    try:
        file_bytes = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read file.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB).")
    if len(file_bytes) < 1024:
        raise HTTPException(status_code=400, detail="File too small.")

    try:
        from app.services.ai_ocr import AadhaarOCRService
        from app.database import supabase

        result = AadhaarOCRService.verify_selfie(file_bytes, content_type)
        passed = result.get("liveness_passed", False)

        if supabase:
            supabase.table("documents").insert({
                "user_id": current_user["sub"],
                "document_type": "live_selfie",
                "verification_status": "verified" if passed else "rejected_liveness",
                "ai_ocr_data": result,
            }).execute()

        return APIResponse(
            success=passed,
            message="Selfie liveness verified." if passed
                    else result.get("rejection_reason", "Selfie liveness check failed."),
            data={"status": "verified" if passed else "rejected", "result": result},
        )

    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Selfie verification error: {e}")
        raise HTTPException(status_code=500, detail=f"Selfie verification failed: {str(e)}")

