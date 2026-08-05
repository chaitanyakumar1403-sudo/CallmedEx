"""
Shared ReportJob Submission Service — CallMedex

Single authoritative service for submitting ReportJobs to MediAssist AI.
Both Patient Upload (ai_reports.py) and Processing Center Verification (pc_operations.py)
invoke this service to prevent logic drift and ensure safe, idempotent submission.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.database import supabase
from app.integrations.mediassist_client import (
    mediassist_client,
    MediAssistError,
    MediAssistUnavailableError,
)

logger = logging.getLogger(__name__)


def _rows(result) -> list:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def get_patient_contact(patient_id: str, db: Optional[Any] = None) -> dict:
    """Look up patient mobile number and preferred language."""
    if db is None:
        db = supabase
    phone = None
    preferred_language = "en"
    if not db or not patient_id:
        return {"phone": phone, "preferred_language": preferred_language}

    try:
        user_rows = _rows(
            db.table("users").select("mobile").eq("id", patient_id).limit(1).execute()
        )
        if user_rows:
            phone = user_rows[0].get("mobile")

        profile_rows = _rows(
            db.table("patients")
            .select("preferred_language")
            .eq("user_id", patient_id)
            .limit(1)
            .execute()
        )
        if profile_rows and profile_rows[0].get("preferred_language"):
            preferred_language = profile_rows[0]["preferred_language"]
    except Exception as e:
        logger.warning(f"Error fetching patient contact for {patient_id}: {e}")

    return {"phone": phone, "preferred_language": preferred_language}


async def submit_report_job_to_mediassist(
    *,
    report_job_id: str,
    patient_id: str,
    source_type: str = "lab_report",
    source_document_url: str = "",
    booking_id: Optional[str] = None,
    sample_id: Optional[str] = None,
    processing_center_id: Optional[str] = None,
    barcode: Optional[str] = None,
    connector_type: Optional[str] = "patient_upload",
    idempotency_key: Optional[str] = None,
    correlation_id: Optional[str] = None,
    client: Optional[Any] = None,
    db: Optional[Any] = None,
    already_analyzed: bool = False,
) -> Dict[str, Any]:
    """
    Submit a canonical ReportJob to MediAssist AI.

    Guarantees:
    - Exactly-once submission pattern with preserved correlation_id.
    - Single-source implementation shared between patient uploads & PC verification.
    - Safe handling of transient errors without marking recoverable jobs as permanently failed.

    Args:
        already_analyzed: True when the caller already produced and persisted
            a real (non-fabricated) analysis for this report_job_id via the
            in-process Groq/OpenRouter engine before calling this function
            (ai_reports.py's synchronous /analyze path). This call is then
            only for WhatsApp delivery via MediAssist — on failure, we must
            NOT re-run analysis (the P0 engine already produced a real
            result; re-running would double OpenRouter cost/latency for no
            benefit) and must NOT mark the job "failed" (it is already
            correctly "delivered"). Processing-center verified samples
            (pc_operations.py) never set this — they have no prior
            in-process analysis, so the existing fallback-analysis behavior
            is what gets them a result when MediAssist is down.
    """
    if client is None:
        client = mediassist_client
    if db is None:
        db = supabase

    contact = get_patient_contact(patient_id, db=db)

    try:
        response = await client.submit_report_job(
            report_job_id=report_job_id,
            source_type=source_type,
            source_document_url=source_document_url,
            connector_type=connector_type or "patient_upload",
            patient={
                "patient_id": patient_id,
                "phone": contact["phone"],
                "preferred_language": contact["preferred_language"],
            },
            delivery={"channels": ["whatsapp"]},
            booking_id=booking_id,
            sample_id=sample_id,
            processing_center_id=processing_center_id,
            barcode=barcode,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
        )
        # Record analysis source for audit
        if db:
            try:
                db.table("report_jobs").update({
                    "analysis_source": "mediassist",
                }).eq("id", report_job_id).execute()
            except Exception:
                pass  # Column may not exist yet
        return response
    except (MediAssistError, Exception) as e:
        if already_analyzed:
            # P0/P2.7 gate: a real analysis already exists for this job
            # (delivered synchronously by the in-process engine before this
            # function was ever called). MediAssist failing here only means
            # WhatsApp delivery didn't happen — re-running analysis would
            # just double OpenRouter cost, and marking the job "failed"
            # below would incorrectly overwrite an already-delivered result.
            logger.info(
                f"MediAssist WhatsApp handoff failed for already-analyzed "
                f"report job {report_job_id}: {e}. Report was already "
                f"delivered via the in-process engine; skipping fallback "
                f"re-analysis and leaving job status untouched."
            )
            return {"status": "delivered", "analysis_source": "native", "whatsapp_handoff": "failed"}

        logger.warning(
            f"MediAssist unavailable for report job {report_job_id}: {e}. "
            f"Attempting Groq/OpenRouter fallback."
        )

        # ── P2.7: Fall back to in-process AI analysis ────────────────────
        try:
            fallback_result = _run_fallback_analysis(
                report_job_id=report_job_id,
                patient_id=patient_id,
                source_document_url=source_document_url,
                db=db,
            )
            if fallback_result:
                return fallback_result
        except Exception as fallback_err:
            logger.error(f"Fallback analysis also failed for {report_job_id}: {fallback_err}")

        # Both MediAssist and fallback failed — mark as failed
        if db:
            try:
                db.table("report_jobs").update({
                    "status": "failed",
                    "failure_reason": f"MediAssist: {str(e)[:200]}. Fallback also failed.",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", report_job_id).execute()
            except Exception as db_err:
                logger.error(f"Failed to update report_job {report_job_id} to failed: {db_err}")
        raise e


def _run_fallback_analysis(
    *,
    report_job_id: str,
    patient_id: str,
    source_document_url: str,
    db: Any,
) -> Optional[Dict[str, Any]]:
    """Run fallback analysis using Groq/OpenRouter when MediAssist is down.

    Downloads the report from storage and runs in-process analysis.
    Records analysis_source = 'groq_fallback' for audit trail.
    """
    from app.services.groq_report_analyzer import GroqReportAnalyzerService
    from app.services.storage import StorageService
    import uuid as uuid_mod

    # Try to download the file bytes from storage
    file_bytes = None
    content_type = "application/pdf"

    if source_document_url and db:
        try:
            # Try to get the stored file
            file_bytes = StorageService.download_document(source_document_url)
            if source_document_url.endswith((".jpg", ".jpeg")):
                content_type = "image/jpeg"
            elif source_document_url.endswith(".png"):
                content_type = "image/png"
        except Exception as dl_err:
            logger.warning(f"Could not download report for fallback: {dl_err}")
            return None

    if not file_bytes:
        return None

    # Run analysis
    analysis_results = GroqReportAnalyzerService.analyze_report_bytes(file_bytes, content_type)

    if analysis_results.get("error"):
        return None

    now = datetime.now(timezone.utc).isoformat()

    # Update job status to delivered via fallback
    if db:
        try:
            db.table("report_jobs").update({
                "status": "delivered",
                "analysis_source": "groq_fallback",
                "updated_at": now,
            }).eq("id", report_job_id).execute()
        except Exception:
            pass

        # Persist analysis results
        try:
            db.table("ai_report_analyses").insert({
                "id": str(uuid_mod.uuid4()),
                "patient_id": patient_id,
                "report_job_id": report_job_id,
                "raw_report_url": source_document_url,
                "plain_language_summary": analysis_results["plain_language_summary"],
                "doctor_clinical_summary": analysis_results["doctor_clinical_summary"],
                "abnormal_flags": analysis_results.get("abnormal_flags", []),
                "created_at": now,
            }).execute()
        except Exception as db_err:
            logger.warning(f"Could not persist fallback analysis: {db_err}")

    logger.info(f"Fallback analysis completed for report job {report_job_id}")
    return {"status": "delivered", "source": "groq_fallback"}

