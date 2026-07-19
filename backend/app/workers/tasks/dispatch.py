"""
Dispatch background tasks.
Expires stale dispatch requests, auto-reassigns unaccepted tasks.
"""
import logging
from datetime import datetime, timezone, timedelta
from app.workers.celery_app import celery_app
from app.database import supabase

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.dispatch.expire_stale_dispatches", bind=True)
def expire_stale_dispatches(self):
    """
    Expire dispatch requests that have been 'pending' for more than 5 minutes
    without being accepted by any provider.
    Runs every 5 minutes via Celery Beat.
    """
    if not supabase:
        return {"expired": 0}

    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()

        result = (
            supabase.table("dispatch_requests")
            .update({"status": "cancelled", "cancel_reason": "No provider available in your area. Please try again."})
            .eq("status", "pending")
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
        from app.services.dispatch_engine import UniversalDispatchEngine
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            UniversalDispatchEngine.find_nearest_provider(
                service_type=service_type,
                patient_lat=patient_lat,
                patient_lng=patient_lng,
                radius_km=radius_km,
            )
        )
        loop.close()

        if result.get("provider_id"):
            supabase.table("dispatch_requests").update({
                "provider_id": result["provider_id"],
                "status": "assigned",
                "estimated_distance_km": result.get("distance_km"),
                "assigned_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", dispatch_id).execute()
            logger.info(f"Dispatch {dispatch_id} assigned to provider {result['provider_id']}")
        else:
            logger.warning(f"No provider found for dispatch {dispatch_id}")

    except Exception as e:
        logger.error(f"trigger_dispatch_async failed for {dispatch_id}: {e}")
