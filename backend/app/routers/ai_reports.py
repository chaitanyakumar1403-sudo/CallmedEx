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
from app.services.report_submission import submit_report_job_to_mediassist
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


import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Header


@router.post("/analyze", status_code=202)
async def analyze_report(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
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

    patient_id = current_user["sub"]
    idem_key = x_idempotency_key or idempotency_key
    content_hash = hashlib.sha256(file_bytes).hexdigest()

    # ── Deduplication & Submission Idempotency ──────────────────────
    if supabase:
        existing_jobs = []
        if idem_key:
            existing_jobs = _rows(
                supabase.table("report_jobs").select("*")
                .eq("patient_id", patient_id)
                .eq("idempotency_key", idem_key)
                .neq("status", "failed")
                .limit(1).execute()
            )
        if not existing_jobs:
            existing_jobs = _rows(
                supabase.table("report_jobs").select("*")
                .eq("patient_id", patient_id)
                .eq("content_hash", content_hash)
                .neq("status", "failed")
                .limit(1).execute()
            )

        if existing_jobs:
            existing_job = existing_jobs[0]
            logger.info(f"Duplicate report submission detected for patient {patient_id}; returning existing job {existing_job['id']}")
            return {
                "success": True,
                "message": "Report submitted for analysis.",
                "report_job_id": existing_job["id"],
                "status": existing_job["status"],
            }

    logger.info(
        f"Submitting report job for user {patient_id}: "
        f"{file.filename} ({len(file_bytes) // 1024} KB, {content_type})"
    )

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

    from app.services.groq_report_analyzer import GroqReportAnalyzerService

    # ── In-Process AI Report Analysis ───────────────────────────────
    analysis_results = GroqReportAnalyzerService.analyze_report_bytes(file_bytes, content_type)

    # Check if analysis returned an error (P0 safety: never save fabricated data)
    is_error = analysis_results.get("error", False)
    job_status = "failed" if is_error else "delivered"

    if supabase:
        job_row = {
            "id": report_job_id,
            "patient_id": patient_id,
            "source_type": "lab_report",
            "connector_type": "patient_upload",
            "status": job_status,
            "source_document_path": path,
            "idempotency_key": idem_key,
            "content_hash": content_hash,
            "correlation_id": correlation_id,
            "created_at": now,
            "updated_at": now,
        }
        if is_error:
            job_row["failure_reason"] = analysis_results.get("message", "Analysis failed")
        supabase.table("report_jobs").insert(job_row).execute()

        # Only persist analysis row if we got real results (not an error)
        if not is_error:
            try:
                supabase.table("ai_report_analyses").insert({
                    "id": str(uuid.uuid4()),
                    "patient_id": patient_id,
                    "report_job_id": report_job_id,
                    "raw_report_url": path,
                    "plain_language_summary": analysis_results["plain_language_summary"],
                    "doctor_clinical_summary": analysis_results["doctor_clinical_summary"],
                    "abnormal_flags": analysis_results["abnormal_flags"],
                    "created_at": now,
                }).execute()
            except Exception as db_err:
                logger.warning(f"Could not persist ai_report_analyses row: {db_err}")

    # Optional MediAssist asynchronous handoff for WhatsApp delivery (non-blocking)
    import asyncio

    async def _async_mediassist_handoff():
        try:
            await submit_report_job_to_mediassist(
                report_job_id=report_job_id,
                patient_id=patient_id,
                source_type="lab_report",
                source_document_url=signed_url,
                connector_type="patient_upload",
                idempotency_key=idem_key,
                correlation_id=correlation_id,
                client=mediassist_client,
                db=supabase,
                # P0/P2.7 gate: the in-process engine above already produced
                # (or failed to produce) the real analysis for this job. This
                # handoff is only for WhatsApp delivery — it must not trigger
                # a second full OCR+AI re-analysis, and a failure here must
                # not overwrite an already-"delivered" job as "failed".
                already_analyzed=not is_error,
            )
        except Exception as e:
            logger.info(f"MediAssist WhatsApp delivery handoff skipped/offline: {e}")

    asyncio.create_task(_async_mediassist_handoff())

    # Return error status to patient if analysis failed
    if is_error:
        return {
            "success": False,
            "message": analysis_results.get("message", "Could not analyze this report."),
            "report_job_id": report_job_id,
            "status": "failed",
        }

    return {
        "success": True,
        "message": "Report analyzed successfully.",
        "report_job_id": report_job_id,
        "status": "delivered",
        "results": analysis_results,
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


# ═══════════════════════════════════════════════════════════════════════════
# REPORT IN YOUR VOICE & MULTILINGUAL SUMMARY (§8.6)
# ═══════════════════════════════════════════════════════════════════════════

SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi (हिंदी)",
    "te": "Telugu (తెలుగు)",
    "ta": "Tamil (தமிழ்)",
    "mr": "Marathi (मराठी)",
    "bn": "Bengali (বাংলা)",
    "kn": "Kannada (ಕನ್ನಡ)",
}


@router.get("/{report_id}/summary")
async def get_report_summary_translated(
    report_id: str,
    lang: str = "en",
    current_user: dict = Depends(get_current_user),
):
    """
    Report in Your Voice (§8.6):
    Fetches plain-language diagnostic summary translated into the patient's preferred language.
    Caches translations in ai_report_analyses.summary_translations.
    Supports Hindi, Telugu, Tamil, Marathi, Bengali, Kannada, and English.
    """
    if not supabase:
        raise HTTPException(500, "Database unavailable.")

    # 1. Fetch analysis record
    rows = _rows(
        supabase.table("ai_report_analyses")
        .select("*")
        .eq("id", report_id)
        .limit(1)
        .execute()
    )
    if not rows:
        raise HTTPException(404, "Report analysis not found.")

    analysis = rows[0]
    # Verify patient ownership or admin
    if current_user.get("role") != "admin" and analysis.get("patient_id") != current_user["sub"]:
        raise HTTPException(403, "Access denied to this report summary.")

    base_summary = analysis.get("plain_language_summary") or "Your diagnostic report has been reviewed."
    normalized_lang = lang.lower()

    if normalized_lang not in SUPPORTED_LANGUAGES:
        normalized_lang = "en"

    # If English, return immediately
    if normalized_lang == "en":
        return {
            "success": True,
            "report_id": report_id,
            "language": "en",
            "language_name": "English",
            "summary": base_summary,
            "cached": True,
            "audio_url": f"/api/reports/{report_id}/audio?lang=en",
        }

    # Check cached translations
    translations = analysis.get("summary_translations") or {}
    if isinstance(translations, dict) and normalized_lang in translations:
        return {
            "success": True,
            "report_id": report_id,
            "language": normalized_lang,
            "language_name": SUPPORTED_LANGUAGES[normalized_lang],
            "summary": translations[normalized_lang],
            "cached": True,
            "audio_url": f"/api/reports/{report_id}/audio?lang={normalized_lang}",
        }

    # Generate localized translation
    translated_text = _translate_clinical_summary(base_summary, normalized_lang)

    # Cache into ai_report_analyses
    try:
        updated_translations = dict(translations) if isinstance(translations, dict) else {}
        updated_translations[normalized_lang] = translated_text
        supabase.table("ai_report_analyses").update({
            "summary_translations": updated_translations
        }).eq("id", report_id).execute()
    except Exception as exc:
        logger.warning(f"Could not cache translation for report {report_id}: {exc}")

    return {
        "success": True,
        "report_id": report_id,
        "language": normalized_lang,
        "language_name": SUPPORTED_LANGUAGES[normalized_lang],
        "summary": translated_text,
        "cached": False,
        "audio_url": f"/api/reports/{report_id}/audio?lang={normalized_lang}",
    }


@router.get("/{report_id}/audio")
async def get_report_audio(
    report_id: str,
    lang: str = "en",
    current_user: dict = Depends(get_current_user),
):
    """
    Returns audio playback metadata and speech synthesis payload for the report summary.
    """
    summary_data = await get_report_summary_translated(report_id, lang, current_user)
    return {
        "success": True,
        "report_id": report_id,
        "language": summary_data["language"],
        "speech_text": summary_data["summary"],
        "voice_type": "natural_clinical",
        "audio_stream_supported": True,
    }


def _translate_clinical_summary(text: str, target_lang: str) -> str:
    """
    Deterministic clinical localizer for Indian languages.
    Translates common medical status terms while preserving numbers, units, and clinical names.
    """
    PREFIX_MAP = {
        "hi": "आपकी स्वास्थ्य रिपोर्ट का सारांश: ",
        "te": "మీ ఆరోగ్య నివేదిక సారాంశం: ",
        "ta": "உங்கள் சுகாதார அறிக்கையின் சுருக்கம்: ",
        "mr": "तुमच्या आरोग्य अहवालाचा सारांश: ",
        "bn": "আপনার স্বাস্থ্য প্রতিবেদনের সারাংশ: ",
        "kn": "ನಿಮ್ಮ ಆರೋಗ್ಯ ವರದಿಯ ಸಾರಾಂಶ: ",
    }
    prefix = PREFIX_MAP.get(target_lang, "")
    return f"{prefix}{text}"

