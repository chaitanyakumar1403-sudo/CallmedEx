"""
AI Reports Router — CallMedex.

CallMedex never does OCR or AI report interpretation itself — that is
MediAssist AI's exclusive job (see docs/integrations/mediassist-ai/). This
router only validates the upload, stores the file, and hands off a
report-analysis job to MediAssist via app.integrations.mediassist_client.
MediAssist AI performs the OCR + interpretation + WhatsApp delivery
asynchronously and calls back into
app/routers/mediassist_inbound.py::report_delivered_callback (or
report-failed) to update this job's status and populate ai_report_analyses.
"""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.storage import StorageService
from app.config import settings
from app.integrations.mediassist_client import mediassist_client, MediAssistError
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["AI Reports"])

# Max file size: 10 MB
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

# content_type -> display name. NOTE: WebP is deliberately NOT included —
# backend/app/services/storage.py's ALLOWED_SIGNATURES (magic-byte check)
# has no WebP entry, so a genuine WebP upload would always fail
# validate_magic_bytes and dead-end in a 500 from upload_document. Until
# WebP magic-byte support exists in storage.py, keep it out of this
# allowlist so it's rejected here with a clean 400 instead.
ALLOWED_TYPES = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "image/png": "PNG",
}

# Real file extensions, derived from ALLOWED_TYPES above — kept distinct from
# the display names because StorageService's magic-byte check expects the
# actual extension (e.g. "jpg", not "jpeg").
_EXT_BY_CONTENT_TYPE = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
}


def _get_patient_contact(patient_id: str) -> dict:
    """Look up the phone number (users.mobile) and preferred_language
    (patients.preferred_language) for a patient. Defaults language to "en"
    if the patients profile row or its preferred_language is absent —
    mirrors mediassist_inbound.py::lookup_patient_by_phone's approach."""
    phone = None
    preferred_language = "en"
    if not supabase:
        return {"phone": phone, "preferred_language": preferred_language}

    user_rows = _rows(
        supabase.table("users").select("mobile").eq("id", patient_id).limit(1).execute()
    )
    if user_rows:
        phone = user_rows[0].get("mobile")

    profile_rows = _rows(
        supabase.table("patients").select("preferred_language")
        .eq("user_id", patient_id).limit(1).execute()
    )
    if profile_rows:
        preferred_language = profile_rows[0].get("preferred_language") or "en"

    return {"phone": phone, "preferred_language": preferred_language}


@router.post("/analyze", status_code=202)
async def analyze_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Patient uploads a lab report (PDF or image). CallMedex stores it and
    submits an async report-analysis job to MediAssist AI — it does NOT
    analyze the report itself. The patient polls GET /jobs/{report_job_id}
    (or waits for the WhatsApp delivery) for the result.
    """
    # ── Validate MIME type ───────────────────────────────────────────
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type}'. Please upload a PDF, JPEG, or PNG.",
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
        f"Submitting report job for user {current_user['sub']}: "
        f"{file.filename} ({len(file_bytes) // 1024} KB, {content_type})"
    )

    patient_id = current_user["sub"]
    ext = _EXT_BY_CONTENT_TYPE[content_type]

    # ── Upload to the reports bucket ─────────────────────────────────
    path = StorageService.upload_document(patient_id, file_bytes, ext, bucket=settings.REPORTS_BUCKET)
    if not path:
        raise HTTPException(
            status_code=500,
            detail="Could not store the uploaded report. Please try again.",
        )

    signed_url = StorageService.signed_url(path, bucket=settings.REPORTS_BUCKET)
    if not signed_url:
        raise HTTPException(
            status_code=500,
            detail="Could not generate an access URL for the uploaded report. Please try again.",
        )

    contact = _get_patient_contact(patient_id)

    report_job_id = str(uuid.uuid4())
    correlation_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    if supabase:
        supabase.table("report_jobs").insert({
            "id": report_job_id,
            "patient_id": patient_id,
            "source_type": "lab_report",
            "status": "queued",
            "source_document_path": path,
            "correlation_id": correlation_id,
            "created_at": now,
            "updated_at": now,
        }).execute()

    try:
        await mediassist_client.submit_report_job(
            source_type="lab_report",
            source_document_url=signed_url,
            patient={
                "patient_id": patient_id,
                "phone": contact["phone"],
                "preferred_language": contact["preferred_language"],
            },
            delivery={"channels": ["whatsapp"]},
            correlation_id=correlation_id,
        )
    except MediAssistError as e:
        logger.error(f"MediAssist rejected report job {report_job_id}: {e}")
        if supabase:
            supabase.table("report_jobs").update({
                "status": "failed",
                "failure_reason": str(e),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", report_job_id).execute()
        raise HTTPException(
            status_code=502,
            detail="MediAssist AI is currently unavailable. Your report was saved and can be resubmitted.",
        )

    return {
        "success": True,
        "message": "Report submitted for analysis.",
        "report_job_id": report_job_id,
        "status": "queued",
    }


@router.get("/jobs/{report_job_id}")
async def get_report_job(
    report_job_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Read the local report_jobs row's status. Never calls MediAssist
    directly — Task 3's callbacks (report-processing/-delivered/-failed/
    -expired) keep this table current as MediAssist processes the job."""
    if not supabase:
        raise HTTPException(status_code=404, detail="Report job not found.")

    rows = _rows(
        supabase.table("report_jobs").select("*").eq("id", report_job_id).limit(1).execute()
    )
    if not rows or rows[0].get("patient_id") != current_user["sub"]:
        raise HTTPException(status_code=404, detail="Report job not found.")

    job = rows[0]
    return {
        "report_job_id": job["id"],
        "status": job["status"],
        "failure_reason": job.get("failure_reason"),
        "updated_at": job.get("updated_at"),
    }


@router.get("/history")
async def get_report_history(
    current_user: dict = Depends(get_current_user),
):
    """Get list of previous lab report analyses for the current patient.

    Reads ai_report_analyses, which is populated by MediAssist's
    report-delivered callback (app/routers/mediassist_inbound.py), not by
    this router.
    """
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
