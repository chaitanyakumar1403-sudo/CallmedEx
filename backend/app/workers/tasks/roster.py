"""
Advance-roster Celery task — runs the next-day assignment pass automatically.

Without this, `run_roster_pass` was only reachable through a manual,
staff-triggered endpoint (POST /api/pc/roster/{date}/run); a centre that
forgot to open the roster page on a given evening would leave every
scheduled home-collection booking for the next day unassigned, with no
alert raised anywhere.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.workers.celery_app import celery_app
from app.database import supabase
from app.services.roster import run_roster_pass, _unassigned_bookings
from app.services.ops_alerts import OpsAlertService

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))


@celery_app.task(
    name="app.workers.tasks.roster.run_advance_roster_for_all_centres",
    bind=True,
    max_retries=2,
)
def run_advance_roster_for_all_centres(self):
    """Assign tomorrow's home-collection bookings for every active processing centre.

    Idempotent per centre/date (run_roster_pass skips bookings that already
    have a dispatch request for that date), so a retry or a manual run the
    same evening never double-assigns.
    """
    if not supabase:
        logger.warning("run_advance_roster_for_all_centres: DB unavailable, skipping")
        return {"centres": 0, "assigned": 0, "unassigned": 0}

    tomorrow = (datetime.now(IST) + timedelta(days=1)).strftime("%Y-%m-%d")

    try:
        centres = supabase.table("processing_centers").select("id").eq("status", "active").execute()
        centre_ids = [c["id"] for c in (centres.data or []) if c.get("id")]
    except Exception as e:
        logger.error(f"run_advance_roster_for_all_centres: failed to list centres: {e}")
        return {"centres": 0, "assigned": 0, "unassigned": 0}

    total_assigned = 0
    total_unassigned = 0

    for centre_id in centre_ids:
        try:
            assigned = run_roster_pass(centre_id, tomorrow)
            total_assigned += len(assigned)
        except Exception as e:
            logger.error(f"Roster pass failed for centre {centre_id} on {tomorrow}: {e}")
            OpsAlertService.create_alert(
                alert_type="roster_pass_failed",
                entity_type="processing_center",
                entity_id=centre_id,
                details={"roster_date": tomorrow, "error": str(e)},
                severity="critical",
            )
            continue

        # Whatever the pass couldn't place (out of radius, nobody available)
        # is deliberately left for the realtime offer flow on the collection
        # day — but that fallback only helps if someone can see it happened.
        try:
            still_unassigned = _unassigned_bookings(centre_id, tomorrow)
        except Exception as e:
            logger.warning(f"Could not check leftover roster bookings for centre {centre_id}: {e}")
            still_unassigned = []

        if still_unassigned:
            total_unassigned += len(still_unassigned)
            OpsAlertService.create_alert(
                alert_type="roster_unassigned",
                entity_type="processing_center",
                entity_id=centre_id,
                details={
                    "roster_date": tomorrow,
                    "unassigned_booking_ids": [b["id"] for b in still_unassigned],
                    "count": len(still_unassigned),
                },
                severity="warning",
            )

    logger.info(
        f"Advance roster pass for {tomorrow}: {len(centre_ids)} centres, "
        f"{total_assigned} assigned, {total_unassigned} left for realtime fallback"
    )
    return {"centres": len(centre_ids), "assigned": total_assigned, "unassigned": total_unassigned}
