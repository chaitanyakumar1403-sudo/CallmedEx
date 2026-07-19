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
