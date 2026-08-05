"""
Same-day / near-term scheduled dispatch trigger.

Advance rostering (roster.py, run_advance_roster_for_all_centres) only ever
assigns TOMORROW's bookings, from a single evening pass. A booking made for
LATER THE SAME DAY — or for tomorrow but made after that evening's pass has
already run — falls into neither bucket: it isn't immediate (bookings.py
only live-dispatches on_demand|/reorder| slot bookings; commit d139443
deliberately stopped every other scheduled booking from firing a live ping
the instant it's booked, hours before the phlebotomist is actually needed),
and it isn't picked up by the roster pass either. Without this task, such a
booking would never reach a phlebotomist at all.

This runs frequently and fires a live dispatch for any CONFIRMED home
collection booking whose slot is now close enough to need a provider, and
that has no dispatch_requests row yet for any reason (roster pass didn't
cover it, booking was made too late in the day for it, etc).
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.workers.celery_app import celery_app
from app.database import supabase
from app.utils.db_helpers import _rows
from app.services.ops_alerts import OpsAlertService

logger = logging.getLogger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))

# How far ahead of the appointment to summon a phlebotomist. Long enough for
# realistic travel time, short enough that a booking for "later tonight"
# still doesn't page a provider hours before they're needed — the exact
# behaviour commit d139443 was written to stop at booking time.
LOOKAHEAD_MINUTES = 90
# Catches bookings this task missed a run for (worker downtime, deploy gap),
# without reaching back so far that a days-old stale row gets paged out of
# nowhere — that belongs to manual/ops follow-up instead.
GRACE_MINUTES = 180


@celery_app.task(
    name="app.workers.tasks.scheduled_dispatch.trigger_dispatch_for_upcoming_bookings",
    bind=True,
)
def trigger_dispatch_for_upcoming_bookings(self):
    if not supabase:
        logger.warning("trigger_dispatch_for_upcoming_bookings: DB unavailable, skipping")
        return {"checked": 0, "dispatched": 0}

    now_ist = datetime.now(IST)
    window_start = (now_ist - timedelta(minutes=GRACE_MINUTES)).strftime("%Y-%m-%dT%H:%M:%S")
    window_end = (now_ist + timedelta(minutes=LOOKAHEAD_MINUTES)).strftime("%Y-%m-%dT%H:%M:%S")

    try:
        candidates = _rows(
            supabase.table("bookings")
            .select(
                "id, patient_id, collection_lat, collection_lng, collection_city, "
                "collection_district, notes, selected_tests, processing_center_id, "
                "slot_start, slot_id"
            )
            .eq("booking_kind", "home_collection")
            .eq("status", "confirmed")
            .gte("slot_start", window_start)
            .lte("slot_start", window_end)
            .execute()
        )
    except Exception as e:
        logger.error(f"trigger_dispatch_for_upcoming_bookings: query failed: {e}")
        return {"checked": 0, "dispatched": 0}

    if not candidates:
        return {"checked": 0, "dispatched": 0}

    # on_demand|/reorder| bookings already get their dispatch attempt (plus
    # a dedicated retry queue on failure) at booking time in bookings.py —
    # re-triggering them here would race that retry path and could create a
    # second, duplicate dispatch_requests row for the same booking.
    candidates = [
        c for c in candidates
        if not str(c.get("slot_id") or "").startswith(("on_demand|", "reorder|"))
    ]
    if not candidates:
        return {"checked": 0, "dispatched": 0}

    booking_ids = [c["id"] for c in candidates]
    try:
        existing = _rows(
            supabase.table("dispatch_requests")
            .select("booking_id")
            .in_("booking_id", booking_ids)
            .execute()
        )
        already_dispatched = {r["booking_id"] for r in existing if r.get("booking_id")}
    except Exception as e:
        logger.error(f"trigger_dispatch_for_upcoming_bookings: dispatch_requests check failed: {e}")
        already_dispatched = set()

    from app.services.dispatch_engine import UniversalDispatchEngine

    dispatched = 0
    for booking in candidates:
        if booking["id"] in already_dispatched:
            continue

        lat = booking.get("collection_lat")
        lng = booking.get("collection_lng")
        if lat is None or lng is None:
            logger.warning(f"Booking {booking['id']} due for dispatch but has no coordinates; skipping.")
            OpsAlertService.create_alert(
                alert_type="scheduled_dispatch_missing_coordinates",
                entity_type="booking",
                entity_id=booking["id"],
                severity="warning",
                details={"slot_start": booking.get("slot_start")},
            )
            continue

        notes_raw = booking.get("notes") or ""
        address = (
            notes_raw.split("Collection address:")[-1].strip()
            if "Collection address:" in notes_raw
            else ", ".join(filter(None, [booking.get("collection_city"), booking.get("collection_district")]))
        )

        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    UniversalDispatchEngine.create_dispatch(
                        patient_id=booking.get("patient_id"),
                        patient_lat=float(lat),
                        patient_lng=float(lng),
                        patient_address=address,
                        provider_type="phlebotomist",
                        service_subtype="home_collection",
                        booking_id=booking["id"],
                        notes=f"Home collection: {', '.join((booking.get('selected_tests') or [])[:3])}",
                        priority="normal",
                        processing_center_id=booking.get("processing_center_id"),
                    )
                )
            finally:
                loop.close()
            dispatched += 1
        except Exception as e:
            logger.error(f"Failed to trigger scheduled dispatch for booking {booking['id']}: {e}")
            OpsAlertService.create_alert(
                alert_type="scheduled_dispatch_failed",
                entity_type="booking",
                entity_id=booking["id"],
                severity="critical",
                details={"error": str(e), "slot_start": booking.get("slot_start")},
            )

    logger.info(
        f"trigger_dispatch_for_upcoming_bookings: {len(candidates)} candidates, "
        f"{dispatched} dispatched"
    )
    return {"checked": len(candidates), "dispatched": dispatched}
