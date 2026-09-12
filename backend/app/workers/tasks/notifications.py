"""
Notification background tasks.
Requests appointment/booking/dispatch WhatsApp notifications from MediAssist
AI — CallMedex never composes or sends WhatsApp messages itself (see
docs/integrations/mediassist-ai/). These tasks only supply structured
template data; MediAssist owns rendering and delivery.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from app.workers.celery_app import celery_app
from app.database import supabase
from app.integrations.mediassist_client import mediassist_client, MediAssistError

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Bridge a Celery task's sync context to the async MediAssist client.

    Matches the pattern already used in app/workers/tasks/dispatch.py:
    Celery workers don't run an event loop, so each call gets its own.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.workers.tasks.notifications.send_appointment_reminders", bind=True, max_retries=2)
def send_appointment_reminders(self):
    """
    Find appointments happening today and send multi-channel alerts to patient and doctor.
    Runs every 10 minutes via Celery Beat.
    """
    if not supabase:
        logger.warning("Supabase not configured — skipping reminders")
        return {"sent": 0}

    try:
        from app.services.appointment_alerts import AppointmentAlertService
        res = _run_async(AppointmentAlertService.run_appointment_alerts_pass())
        sent_count = res.get("sent_count", 0)
        logger.info(f"Appointment reminders dispatched: {sent_count}")
        return {"sent": sent_count, "result": res}
    except Exception as e:
        logger.error(f"send_appointment_reminders failed: {e}")
        raise self.retry(exc=e, countdown=60)


@celery_app.task(name="app.workers.tasks.notifications.send_booking_confirmation")
def send_booking_confirmation(booking_id: str, patient_mobile: str, patient_name: str, slot_time: str, service_type: str):
    """
    Async task: Send WhatsApp/SMS booking confirmation immediately after booking.
    Triggered by the bookings router.
    """
    try:
        _run_async(mediassist_client.send_notification(
            channel="whatsapp",
            recipient={"phone": patient_mobile},
            template="booking_confirmed",
            template_data={
                "patient_name": patient_name,
                "service_name": service_type,
                "scheduled_at": slot_time,
                "booking_reference": booking_id,
            },
        ))
        logger.info(f"Booking confirmation notification requested for {booking_id}")
    except MediAssistError as e:
        logger.error(f"Booking confirmation notification failed for {booking_id}: {e}")


