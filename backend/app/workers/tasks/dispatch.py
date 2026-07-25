"""
Dispatch background tasks.
Expires stale dispatch requests, auto-reassigns unaccepted tasks.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from app.workers.celery_app import celery_app
from app.database import supabase

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.dispatch.expire_stale_dispatches", bind=True)
def expire_stale_dispatches(self):
    """
    Expire dispatch requests that have been waiting for more than 5 minutes
    without being accepted by any provider.
    Runs every 5 minutes via Celery Beat.
    """
    if not supabase:
        return {"expired": 0}

    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()

        # A dispatch that nobody has accepted sits in 'searching' (no offer taken)
        # or 'provider_notified' (offers sent, none answered). There is no
        # 'pending' status on dispatch_requests — filtering on it matched nothing,
        # so stale requests were never swept.
        result = (
            supabase.table("dispatch_requests")
            .update({"status": "cancelled", "cancel_reason": "No provider available in your area. Please try again."})
            .in_("status", ["searching", "provider_notified"])
            .lte("created_at", cutoff)
            .execute()
        )

        expired_count = len(result.data or [])
        if expired_count > 0:
            logger.info(f"Expired {expired_count} stale dispatch requests")

        return {"expired": expired_count}
    except Exception as e:
        logger.error(f"expire_stale_dispatches failed: {e}")
        return {"expired": 0, "error": str(e)}


@celery_app.task(name="app.workers.tasks.dispatch.trigger_dispatch")
def trigger_dispatch_async(dispatch_id: str, service_type: str, patient_lat: float, patient_lng: float, radius_km: float = 10.0):
    """
    Async background dispatch: find and notify nearest available providers.
    Triggered immediately after a dispatch request is created.
    """
    if not supabase:
        return

    try:
        from app.services.dispatch_engine import (
            UniversalDispatchEngine,
            OFFER_EXPIRY_SECONDS,
        )
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        candidates = loop.run_until_complete(
            UniversalDispatchEngine.find_nearby_providers(
                patient_lat,
                patient_lng,
                service_type,
                radius_km=radius_km,
            )
        )
        loop.close()

        if not candidates:
            logger.warning(f"No provider found for dispatch {dispatch_id}")
            return

        # Fan offers out to every candidate and let them accept, matching
        # UniversalDispatchEngine.create_dispatch. This task previously tried to
        # auto-assign the closest provider by writing a 'provider_id' column and
        # an 'assigned' status — neither exists on dispatch_requests, and the
        # engine deliberately stopped auto-assigning.
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        expires_at = (now + timedelta(seconds=OFFER_EXPIRY_SECONDS)).isoformat()

        for candidate in candidates:
            supabase.table("dispatch_offers").insert({
                "id": str(uuid.uuid4()),
                "dispatch_request_id": dispatch_id,
                "provider_id": candidate["user_id"],
                "status": "pending",
                "distance_km": candidate["distance_km"],
                "offered_at": now_iso,
                "responded_at": None,
                "expires_at": expires_at,
            }).execute()

        nearest = candidates[0]
        supabase.table("dispatch_requests").update({
            "status": "provider_notified",
            "estimated_distance_km": nearest["distance_km"],
            "estimated_eta_minutes": nearest["eta_minutes"],
            "updated_at": now_iso,
        }).eq("id", dispatch_id).execute()

        logger.info(f"Dispatch {dispatch_id} offered to {len(candidates)} provider(s)")

    except Exception as e:
        logger.error(f"trigger_dispatch_async failed for {dispatch_id}: {e}")
