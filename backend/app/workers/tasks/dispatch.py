"""
Dispatch background tasks.
Expires stale dispatch requests, auto-reassigns unaccepted tasks.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from app.workers.celery_app import celery_app
from app.database import supabase
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.dispatch.expire_stale_dispatches", bind=True)
def expire_stale_dispatches(self):
    """
    Expire dispatch requests that have been waiting longer than the offer window
    without being accepted by any provider. Also triggers re-fan-out for
    individual expired offers before cancelling the whole dispatch.
    Runs every 5 minutes via Celery Beat.
    """
    if not supabase:
        return {"expired": 0}

    try:
        from app.services.dispatch_engine import DEFAULT_OFFER_WINDOW_MINUTES

        # P1.4: Use the dispatch engine's authoritative offer window (10 min),
        # not the old hardcoded 5 minutes that disagreed with the email/MOU.
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=DEFAULT_OFFER_WINDOW_MINUTES)).isoformat()

        # P1.5: First, expire individual offers and trigger re-fan-out
        _expire_individual_offers(cutoff)

        # Then expire dispatches where ALL offers have expired/been rejected
        # and no re-fan-out produced new candidates
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


# ─── P1.5: Re-Fan-Out on Decline/Expiry ─────────────────────────────────────

MAX_FAN_OUT_ROUNDS = 2
RADIUS_WIDEN_KM = 2.0


def _expire_individual_offers(cutoff_iso: str):
    """Expire individual pending offers past the cutoff and trigger re-fan-out.

    Called by the periodic sweep before whole-dispatch cancellation.
    """
    if not supabase:
        return

    try:
        expired_offers = _rows(
            supabase.table("dispatch_offers")
            .select("id, dispatch_request_id, provider_id")
            .eq("status", "pending")
            .lte("expires_at", cutoff_iso)
            .execute()
        )

        if not expired_offers:
            return

        # Mark them expired
        for offer in expired_offers:
            supabase.table("dispatch_offers").update({
                "status": "expired",
            }).eq("id", offer["id"]).execute()

        # Group by dispatch request for re-fan-out
        dispatch_ids = set(o["dispatch_request_id"] for o in expired_offers)
        for dispatch_id in dispatch_ids:
            _try_re_fan_out(dispatch_id)

    except Exception as e:
        logger.error(f"_expire_individual_offers error: {e}")


def _try_re_fan_out(dispatch_id: str):
    """Attempt to find new providers for a dispatch whose offers expired/were rejected.

    - Widens radius by +2km each round
    - Excludes all previously declined/expired providers
    - After MAX_FAN_OUT_ROUNDS, creates an ops alert
    """
    if not supabase:
        return

    try:
        from app.services.dispatch_engine import UniversalDispatchEngine, OFFER_EXPIRY_SECONDS

        # Get current dispatch state
        dispatch_rows = _rows(
            supabase.table("dispatch_requests")
            .select("*")
            .eq("id", dispatch_id)
            .in_("status", ["searching", "provider_notified"])
            .limit(1)
            .execute()
        )
        if not dispatch_rows:
            return

        dispatch = dispatch_rows[0]
        fan_out_round = (dispatch.get("fan_out_round") or 0) + 1

        if fan_out_round > MAX_FAN_OUT_ROUNDS:
            # All rounds exhausted — alert ops
            from app.services.ops_alerts import OpsAlertService
            OpsAlertService.create_alert(
                alert_type="dispatch_no_provider",
                entity_type="dispatch_request",
                entity_id=dispatch_id,
                severity="critical",
                details={
                    "fan_out_rounds": fan_out_round - 1,
                    "patient_id": dispatch.get("patient_id"),
                    "booking_id": dispatch.get("booking_id"),
                },
            )
            logger.warning(f"Dispatch {dispatch_id}: all {MAX_FAN_OUT_ROUNDS} re-fan-out rounds exhausted")
            return

        # Collect all providers who already declined or expired
        previous_offers = _rows(
            supabase.table("dispatch_offers")
            .select("provider_id")
            .eq("dispatch_request_id", dispatch_id)
            .in_("status", ["rejected", "expired", "declined"])
            .execute()
        )
        excluded_ids = [o["provider_id"] for o in previous_offers]

        # Widen radius
        base_radius = dispatch.get("search_radius_km") or 10.0
        new_radius = base_radius + (RADIUS_WIDEN_KM * fan_out_round)

        patient_lat = dispatch.get("patient_lat") or dispatch.get("lat")
        patient_lng = dispatch.get("patient_lng") or dispatch.get("lng")
        # Use the dispatch's provider_type, not service_type — find_nearby_providers
        # validates against VALID_PROVIDER_TYPES {"nurse","phlebotomist","doctor",...}
        provider_type = dispatch.get("provider_type", "phlebotomist")

        if not patient_lat or not patient_lng:
            logger.error(f"Dispatch {dispatch_id} has no patient coordinates for re-fan-out")
            return

        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        candidates = loop.run_until_complete(
            UniversalDispatchEngine.find_nearby_providers(
                patient_lat, patient_lng, provider_type,
                radius_km=new_radius,
                # The engine parameter is `exclude_ids`, not `exclude_provider_ids`
                exclude_ids=excluded_ids,
            )
        )
        loop.close()

        if not candidates:
            logger.info(f"Dispatch {dispatch_id} re-fan-out round {fan_out_round}: no new providers at {new_radius}km")
            # Update round counter and try again next sweep
            supabase.table("dispatch_requests").update({
                "fan_out_round": fan_out_round,
                "declined_provider_ids": excluded_ids,
            }).eq("id", dispatch_id).execute()
            return

        # Create new offers
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

        # Update dispatch state
        supabase.table("dispatch_requests").update({
            "fan_out_round": fan_out_round,
            "declined_provider_ids": excluded_ids,
            "status": "provider_notified",
            "updated_at": now_iso,
        }).eq("id", dispatch_id).execute()

        logger.info(
            f"Dispatch {dispatch_id} re-fan-out round {fan_out_round}: "
            f"offered to {len(candidates)} new provider(s) at {new_radius}km radius"
        )

    except Exception as e:
        logger.error(f"_try_re_fan_out failed for {dispatch_id}: {e}")
