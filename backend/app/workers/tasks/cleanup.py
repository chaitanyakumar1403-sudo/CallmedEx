"""
Cleanup background tasks.
Removes expired tokens, old sessions, and stale data.
"""
import logging
from datetime import datetime, timezone, timedelta
from app.workers.celery_app import celery_app
from app.database import supabase

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.cleanup.cleanup_expired_mou_tokens")
def cleanup_expired_mou_tokens():
    """
    Daily 3AM: Expire MOU tokens older than 7 days that haven't been accepted.
    """
    if not supabase:
        return {"expired": 0}

    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        result = (
            supabase.table("legal_acceptances")
            .update({"status": "expired"})
            .eq("status", "pending")
            .lte("created_at", cutoff)
            .execute()
        )

        expired_count = len(result.data or [])
        if expired_count > 0:
            logger.info(f"Expired {expired_count} old MOU tokens")

        return {"expired": expired_count}
    except Exception as e:
        logger.error(f"cleanup_expired_mou_tokens failed: {e}")
        return {"expired": 0}


@celery_app.task(name="app.workers.tasks.cleanup.cleanup_old_audit_logs")
def cleanup_old_audit_logs():
    """
    Quarterly: Anonymize PII in audit logs older than 90 days.

    IMPORTANT: Healthcare audit logs must be retained for 3-5 years per
    NMC and DPDP regulations. This task DOES NOT delete records — it only
    redacts personally identifiable information (PII) from older entries
    while preserving the audit trail for compliance.
    """
    if not supabase:
        return {"anonymized": 0}

    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()

        # Fetch old audit logs that still contain PII
        result = (
            supabase.table("audit_log")
            .select("id, details, ip_address, user_agent")
            .lte("created_at", cutoff)
            .is_("anonymized_at", "null")
            .limit(1000)
            .execute()
        )

        count = 0
        now = datetime.now(timezone.utc).isoformat()
        for entry in (result.data or []):
            try:
                # Redact PII from details JSONB
                details = entry.get("details") or {}
                if isinstance(details, dict):
                    for pii_field in ("email", "mobile", "phone", "ip_address", "user_agent"):
                        if pii_field in details:
                            details[pii_field] = "[REDACTED]"

                supabase.table("audit_log").update({
                    "details": details,
                    "ip_address": "[REDACTED]",
                    "user_agent": "[REDACTED]",
                    "anonymized_at": now,
                }).eq("id", entry["id"]).execute()
                count += 1
            except Exception as e:
                logger.warning(f"Failed to anonymize audit log {entry.get('id')}: {e}")

        if count > 0:
            logger.info(f"Anonymized {count} audit log entries older than 90 days")
        return {"anonymized": count}
    except Exception as e:
        logger.error(f"cleanup_old_audit_logs failed: {e}")
        return {"anonymized": 0}
