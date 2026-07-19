"""
Notification background tasks.
Sends WhatsApp/SMS reminders for upcoming appointments.
"""
import logging
from datetime import datetime, timezone, timedelta
from app.workers.celery_app import celery_app
from app.database import supabase

logger = logging.getLogger(__name__)


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
                    # Send WhatsApp message via the communications service
                    message = (
                        f"Dear {name},\n\n"
                        f"⏰ *Appointment Reminder*\n"
                        f"Your appointment is in ~30 minutes at *{slot}*.\n"
                        f"Service: {booking.get('service_type', 'appointment')}\n\n"
                        f"Please be ready. You can reschedule at CallMedex if needed.\n"
                        f"— CallMedex Team 🏥"
                    )

                    # Try to send via WhatsApp API
                    try:
                        from app.services.whatsapp import WhatsAppService
                        WhatsAppService.send_message(mobile, message)
                    except Exception as wa_err:
                        logger.warning(f"WhatsApp send failed: {wa_err}")

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
        message = (
            f"✅ *Booking Confirmed!*\n\n"
            f"Hi {patient_name},\n"
            f"Your booking has been confirmed.\n\n"
            f"📅 Time: *{slot_time}*\n"
            f"🏥 Service: {service_type}\n"
            f"🎫 ID: {booking_id[:8].upper()}\n\n"
            f"You'll receive a reminder 30 minutes before.\n"
            f"Track & manage at: callmedex.com/dashboard\n"
            f"— CallMedex 🩺"
        )

        from app.services.whatsapp import WhatsAppService
        WhatsAppService.send_message(patient_mobile, message)
        logger.info(f"Booking confirmation sent for {booking_id}")
    except Exception as e:
        logger.error(f"Booking confirmation failed: {e}")


@celery_app.task(name="app.workers.tasks.notifications.send_dispatch_update")
def send_dispatch_update(patient_mobile: str, patient_name: str, status: str, provider_name: str = "", eta_mins: int = 0):
    """
    Async task: Notify patient of dispatch status changes in real-time.
    """
    status_messages = {
        "assigned": f"✅ A provider has been assigned to your request!\n👤 Provider: {provider_name}",
        "en_route": f"🚗 Your provider is on the way!\n⏱️ ETA: ~{eta_mins} minutes",
        "arrived": f"📍 Your provider has arrived at your location!\nPlease be ready.",
        "in_progress": f"⚗️ Your service is now in progress.",
        "completed": f"🎉 Service completed successfully!\nThank you for using CallMedex.",
    }

    msg_body = status_messages.get(status, f"Your request status: {status}")
    message = f"Hi {patient_name},\n\n{msg_body}\n\n— CallMedex 🏥"

    try:
        from app.services.whatsapp import WhatsAppService
        WhatsAppService.send_message(patient_mobile, message)
    except Exception as e:
        logger.error(f"Dispatch update notification failed: {e}")
