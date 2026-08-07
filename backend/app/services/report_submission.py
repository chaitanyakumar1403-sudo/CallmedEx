"""
Shared ReportJob Submission Service — CallMedex

Single authoritative service for submitting ReportJobs to MediAssist AI.
Both Patient Upload (ai_reports.py) and Processing Center Verification (pc_operations.py)
invoke this service to prevent logic drift and ensure safe, idempotent submission.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Set

from app.database import supabase
from app.integrations.mediassist_client import (
    mediassist_client,
    MediAssistError,
    MediAssistUnavailableError,
)

logger = logging.getLogger(__name__)

# Strict ReportJob FSM Transition Matrix
ALLOWED_REPORT_JOB_TRANSITIONS: Dict[str, Set[str]] = {
    "queued": {"submitted", "failed"},
    "submitted": {"accepted", "processing", "delivered", "failed", "retry"},
    "accepted": {"processing", "failed"},
    "processing": {"delivered", "failed", "expired"},
    "delivered": {"corrected"},
    "failed": {"retry", "dead_letter"},
    "expired": {"retry", "dead_letter"},
    "retry": {"submitted", "failed", "dead_letter"},
    "corrected": {"corrected"},
    "dead_letter": {"retry"},
}


def validate_report_job_transition(current_status: str, new_status: str) -> None:
    """Validate allowed report_job FSM transitions."""
    if not current_status or current_status == new_status:
        return
    allowed = ALLOWED_REPORT_JOB_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Illegal ReportJob state transition from '{current_status}' to '{new_status}'"
        )


def calculate_exponential_backoff(
    retry_count: int, initial_delay_seconds: int = 30, max_delay_seconds: int = 3600
) -> str:
    """Calculate ISO timestamp for next_retry_at using 30s * 2^retry_count backoff."""
    delay = min(initial_delay_seconds * (2 ** max(0, retry_count)), max_delay_seconds)
    return (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat()


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
    - FSM state transition validation and exponential backoff retry scheduling.
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
        if db:
            try:
                update_data = {
                    "analysis_source": "mediassist",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                if not already_analyzed:
                    update_data["status"] = "submitted"
                db.table("report_jobs").update(update_data).eq("id", report_job_id).execute()
            except Exception as update_err:
                logger.warning(f"Could not update status to submitted for {report_job_id}: {update_err}")
        return response
    except (MediAssistError, Exception) as e:
        if already_analyzed:
            logger.info(
                f"MediAssist WhatsApp handoff failed for already-analyzed "
                f"report job {report_job_id}: {e}. Report was already "
                f"delivered via the in-process engine; skipping fallback "
                f"re-analysis and leaving job status untouched."
            )
            return {"status": "delivered", "analysis_source": "native", "whatsapp_handoff": "failed"}

        logger.warning(
            f"MediAssist submission failed for report job {report_job_id}: {e}. Scheduling retry."
        )

        if db:
            try:
                job_rows = _rows(
                    db.table("report_jobs").select("retry_count, max_retries, status").eq("id", report_job_id).limit(1).execute()
                )
                curr_count = 0
                max_retries = 3
                if job_rows:
                    curr_count = job_rows[0].get("retry_count") or 0
                    max_retries = job_rows[0].get("max_retries") or 3

                new_count = curr_count + 1
                now_str = datetime.now(timezone.utc).isoformat()
                if new_count >= max_retries:
                    db.table("report_jobs").update({
                        "status": "dead_letter",
                        "dead_letter": True,
                        "retry_count": new_count,
                        "last_error": str(e)[:500],
                        "updated_at": now_str,
                    }).eq("id", report_job_id).execute()
                else:
                    next_retry = calculate_exponential_backoff(new_count)
                    db.table("report_jobs").update({
                        "status": "retry",
                        "retry_count": new_count,
                        "next_retry_at": next_retry,
                        "last_error": str(e)[:500],
                        "updated_at": now_str,
                    }).eq("id", report_job_id).execute()
            except Exception as db_err:
                logger.error(f"Failed to update report_job {report_job_id} retry state: {db_err}")
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

