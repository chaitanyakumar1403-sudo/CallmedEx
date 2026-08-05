"""
P1.2 — Dispatch Retry Worker Task.

When dispatch creation fails during booking confirmation, this Celery task
retries with exponential backoff (3 attempts, 30s base delay). On exhaustion,
creates an ops alert for manual intervention.

The booking stays CONFIRMED throughout — the patient is never told the
dispatch failed silently.
"""
import asyncio
import logging

from app.workers.celery_app import celery_app
from app.database import supabase

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.workers.tasks.dispatch_retry.retry_dispatch_creation",
    max_retries=3,
    default_retry_delay=30,
    # No autoretry_for — we handle retry manually so we can create an ops
    # alert on final exhaustion.  autoretry_for would silently re-queue the
    # task before the except block runs, making the alert unreachable.
)
def retry_dispatch_creation(
    self,
    booking_id: str,
    patient_id: str,
    patient_lat: float,
    patient_lng: float,
    patient_address: str = "",
    provider_type: str = "phlebotomist",
    service_subtype: str = "blood_collection",
    notes: str = "",
    search_radius_km: float = 10.0,
    processing_center_id: str = None,
):
    """Retry creating a dispatch request for a confirmed booking.

    Called when the initial dispatch creation in bookings.py fails.
    The booking remains CONFIRMED — the patient is not affected.

    Args match UniversalDispatchEngine.create_dispatch exactly:
        patient_id, patient_lat, patient_lng, patient_address (positional),
        provider_type (positional), plus keyword-only options.
    """
    from app.services.dispatch_engine import UniversalDispatchEngine

    attempt = self.request.retries + 1
    max_attempts = self.max_retries + 1
    logger.info(
        f"Dispatch retry attempt {attempt}/{max_attempts} for booking {booking_id}"
    )

    try:
        # create_dispatch is async — run it in a fresh event loop
        # (Celery workers are sync by default)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                UniversalDispatchEngine.create_dispatch(
                    patient_id=patient_id,
                    patient_lat=patient_lat,
                    patient_lng=patient_lng,
                    patient_address=patient_address,
                    provider_type=provider_type,
                    service_subtype=service_subtype,
                    notes=notes,
                    booking_id=booking_id,
                    search_radius_km=search_radius_km,
                    processing_center_id=processing_center_id,
                )
            )
        finally:
            loop.close()

        logger.info(f"Dispatch retry succeeded for booking {booking_id}: {result}")
        return {"success": True, "booking_id": booking_id, "dispatch": result}

    except Exception as exc:
        if self.request.retries >= self.max_retries:
            # All retries exhausted — create ops alert, do NOT re-raise
            logger.error(
                f"All {max_attempts} dispatch retries exhausted for booking "
                f"{booking_id}. Creating ops alert."
            )
            try:
                from app.services.ops_alerts import OpsAlertService

                OpsAlertService.create_alert(
                    alert_type="dispatch_creation_failed",
                    entity_type="booking",
                    entity_id=booking_id,
                    severity="critical",
                    details={
                        "patient_id": patient_id,
                        "patient_lat": patient_lat,
                        "patient_lng": patient_lng,
                        "provider_type": provider_type,
                        "retries_attempted": max_attempts,
                        "last_error": str(exc)[:500],
                    },
                )
            except Exception as alert_err:
                logger.error(f"Failed to create ops alert: {alert_err}")

            return {
                "success": False,
                "booking_id": booking_id,
                "error": str(exc)[:200],
            }

        # Retries remaining — use Celery's retry() with exponential backoff
        # (30s × 2^retries with jitter)
        backoff = 30 * (2 ** self.request.retries)
        logger.warning(
            f"Dispatch creation failed for booking {booking_id}, "
            f"retrying in {backoff}s (attempt {attempt}/{max_attempts}): {exc}"
        )
        raise self.retry(exc=exc, countdown=backoff)
