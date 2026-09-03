"""
ReportJob retry sweep.

report_submission.submit_report_job_to_mediassist already writes the retry
state machine on failure — status "retry", an incremented retry_count and an
exponential-backoff next_retry_at. Nothing consumed it: the only thing that
ever re-submitted a due job was an admin manually calling
POST /api/admin/report-jobs/retry-failed, and no UI calls that endpoint.

So a lab report whose first handoff to MediAssist failed sat in "retry"
forever and the patient never received it. This task closes that loop.
"""
import asyncio
import logging
from datetime import datetime, timezone

from app.workers.celery_app import celery_app
from app.database import supabase

logger = logging.getLogger(__name__)

# ponytail: one pass per tick, capped. A backlog drains over several ticks
# rather than blocking the worker on a long serial run of network calls.
MAX_JOBS_PER_SWEEP = 50


def _run_async(coro):
    """Celery workers have no running event loop — give each call its own.

    Same bridge as app/workers/tasks/notifications.py.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.workers.tasks.report_retry.retry_due_report_jobs", bind=True)
def retry_due_report_jobs(self):
    """Re-submit every ReportJob whose next_retry_at has come due."""
    if not supabase:
        logger.warning("ReportJob retry sweep skipped: database unavailable")
        return {"scanned": 0, "retried": 0, "failed": 0}

    now_str = datetime.now(timezone.utc).isoformat()
    try:
        result = (
            supabase.table("report_jobs")
            .select("*")
            .in_("status", ["failed", "retry"])
            .eq("dead_letter", False)
            .lte("next_retry_at", now_str)
            .limit(MAX_JOBS_PER_SWEEP)
            .execute()
        )
        jobs = [dict(r) for r in (result.data or []) if isinstance(r, dict)]
    except Exception as e:
        logger.error(f"ReportJob retry sweep could not read report_jobs: {e}")
        return {"scanned": 0, "retried": 0, "failed": 0, "error": str(e)}

    if not jobs:
        return {"scanned": 0, "retried": 0, "failed": 0}

    from app.services.report_submission import submit_report_job_to_mediassist

    retried = 0
    failed = 0
    for job in jobs:
        try:
            # submit_report_job_to_mediassist re-arms next_retry_at (or flips
            # the job to dead_letter once max_retries is exhausted) on failure,
            # so a permanently broken job stops being picked up on its own.
            _run_async(
                submit_report_job_to_mediassist(
                    report_job_id=job["id"],
                    patient_id=job.get("patient_id") or "",
                    booking_id=job.get("booking_id"),
                    sample_id=job.get("sample_id"),
                    processing_center_id=job.get("processing_center_id"),
                    barcode=job.get("barcode"),
                    connector_type=job.get("connector_type") or "mocdoc",
                    idempotency_key=job.get("idempotency_key"),
                    correlation_id=job.get("correlation_id"),
                    db=supabase,
                )
            )
            retried += 1
        except Exception as e:
            failed += 1
            logger.warning(f"ReportJob {job['id']} retry attempt failed: {e}")

    logger.info(
        f"ReportJob retry sweep: scanned={len(jobs)} retried={retried} failed={failed}"
    )
    return {"scanned": len(jobs), "retried": retried, "failed": failed}
