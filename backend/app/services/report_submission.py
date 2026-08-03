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
) -> Dict[str, Any]:
    """
    Submit a canonical ReportJob to MediAssist AI.

    Guarantees:
    - Exactly-once submission pattern with preserved correlation_id.
    - Single-source implementation shared between patient uploads & PC verification.
    - Safe handling of transient errors without marking recoverable jobs as permanently failed.
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
        return response
    except MediAssistError as e:
        logger.error(f"MediAssist rejected report job {report_job_id}: {e}")
        if db:
            try:
                db.table("report_jobs").update({
                    "status": "failed",
                    "failure_reason": str(e),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", report_job_id).execute()
            except Exception as db_err:
                logger.error(f"Failed to update report_job {report_job_id} to failed: {db_err}")
        raise e
