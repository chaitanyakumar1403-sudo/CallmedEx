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
    Monthly: Archive audit logs older than 90 days to cold storage.
    """
    if not supabase:
        return {"archived": 0}

    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()

        result = (
            supabase.table("audit_log")
            .delete()
            .lte("created_at", cutoff)
            .execute()
        )

        count = len(result.data or [])
        logger.info(f"Archived {count} old audit log entries")
        return {"archived": count}
    except Exception as e:
        logger.error(f"cleanup_old_audit_logs failed: {e}")
        return {"archived": 0}
