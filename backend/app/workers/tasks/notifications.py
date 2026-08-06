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
    Find bookings happening in the next 30-40 minutes and send reminders.
    Runs every 10 minutes via Celery Beat.
    """
    if not supabase:
        logger.warning("Supabase not configured — skipping reminders")
        return {"sent": 0}

    try:
        now = datetime.now(timezone.utc)
        reminder_window_start = (now + timedelta(minutes=25)).isoformat()
        reminder_window_end = (now + timedelta(minutes=45)).isoformat()
        today = now.date().isoformat()

        # Find confirmed bookings in the window that haven't been reminded
        result = (
            supabase.table("bookings")
            .select("id, patient_id, provider_id, slot_time, service_type, reminder_sent")
            .eq("status", "confirmed")
            .eq("booking_date", today)
            .eq("reminder_sent", False)
            .gte("slot_time", reminder_window_start[:5])  # HH:MM comparison
            .lte("slot_time", reminder_window_end[:5])
            .execute()
        )

        bookings = result.data or []
        sent_count = 0

        for booking in bookings:
            try:
                # Get patient info
                patient_result = supabase.table("users").select("full_name, mobile").eq("id", booking["patient_id"]).execute()
                if not patient_result.data:
                    continue

                patient = patient_result.data[0]
                mobile = patient.get("mobile", "")
                name = patient.get("full_name", "Patient")
                slot = booking.get("slot_time", "")

                if mobile:
                    try:
                        _run_async(mediassist_client.send_notification(
                            channel="whatsapp",
                            recipient={"phone": mobile, "patient_id": booking["patient_id"]},
                            template="appointment_reminder",
                            template_data={
                                "patient_name": name,
                                "service_name": booking.get("service_type", "appointment"),
                                "scheduled_at": slot,
                            },
                        ))
                    except MediAssistError as wa_err:
                        logger.warning(f"MediAssist notification failed for booking {booking['id']}: {wa_err}")

                # Mark as reminded
                supabase.table("bookings").update({
                    "reminder_sent": True,
                    "reminder_sent_at": now.isoformat(),
                }).eq("id", booking["id"]).execute()

                sent_count += 1
            except Exception as booking_err:
                logger.error(f"Error processing reminder for booking {booking['id']}: {booking_err}")

        logger.info(f"Appointment reminders sent: {sent_count}/{len(bookings)}")
        return {"sent": sent_count, "total": len(bookings)}

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


