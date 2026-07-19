"""
AI Reports Router — Next-Gen CallMedex
Patient uploads a lab report PDF or image → Gemini AI interprets it.
Returns plain-language patient summary + clinical summary + abnormal flags.
"""
import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.ai_reports import AIReportService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["AI Reports"])

# Max file size: 10 MB
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

ALLOWED_TYPES = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
}


@router.post("/analyze")
async def analyze_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Patient uploads a lab report (PDF or Image). AI analyzes it and returns:
    - plain_language_summary: patient-friendly explanation
    - doctor_clinical_summary: clinical overview for the doctor
    - abnormal_flags: list of out-of-range values
    """
    # ── Validate MIME type ───────────────────────────────────────────
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type}'. Please upload a PDF, JPEG, PNG, or WebP.",
        )

    # ── Read file bytes ──────────────────────────────────────────────
    try:
        file_bytes = await file.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        raise HTTPException(status_code=400, detail="Could not read the uploaded file.")

    # ── Validate file size ───────────────────────────────────────────
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large ({len(file_bytes) // (1024*1024)} MB). Maximum allowed size is 10 MB.",
        )

    logger.info(
        f"Analyzing report for user {current_user['sub']}: "
        f"{file.filename} ({len(file_bytes) // 1024} KB, {content_type})"
    )

    # ── Run AI analysis ──────────────────────────────────────────────
    try:
        ai_output = AIReportService.interpret_lab_report(file_bytes, content_type)
    except ValueError as e:
        # Known AI error (bad response, parse failure, etc.)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected AI analysis error: {e}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while analyzing the report. Please try again.",
        )

    # ── Persist result to DB ─────────────────────────────────────────
    analysis_id = str(uuid.uuid4())
    if supabase:
        try:
            supabase.table("ai_report_analyses").insert({
                "id": analysis_id,
                "patient_id": current_user["sub"],
                "raw_report_url": file.filename or "uploaded_file",
                "plain_language_summary": ai_output.get("plain_language_summary", ""),
                "doctor_clinical_summary": ai_output.get("doctor_clinical_summary", ""),
                "abnormal_flags": ai_output.get("abnormal_flags", []),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            # Don't fail the whole request if DB insert fails
            logger.warning(f"Could not save analysis to DB: {e}")

    return {
        "success": True,
        "message": "Report analyzed successfully.",
        "analysis_id": analysis_id,
        "results": ai_output,
    }


@router.get("/history")
async def get_report_history(
    current_user: dict = Depends(get_current_user),
):
    """Get list of previous lab report analyses for the current patient."""
    if not supabase:
        return {"success": True, "analyses": []}

    try:
        result = (
            supabase.table("ai_report_analyses")
            .select("id, raw_report_url, plain_language_summary, created_at")
            .eq("patient_id", current_user["sub"])
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        return {"success": True, "analyses": result.data or []}
    except Exception as e:
        logger.warning(f"Could not fetch report history: {e}")
        return {"success": True, "analyses": []}
