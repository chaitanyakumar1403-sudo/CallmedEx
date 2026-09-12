"""
Appointment Alert & Lifecycle Service — CallMedex
Provides automated day-of-appointment notifications, teleconsultation dispatch alerts,
and doctor/patient coordination pings.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from app.database import supabase
from app.services.notification_engine import NotificationEngine

logger = logging.getLogger(__name__)


class AppointmentAlertService:
    """
    Central service for dispatching day-of-appointment alerts to patients and doctors,
    ensuring no scheduled consultation is forgotten.
    """

    @staticmethod
    def resolve_slot_datetime_ist(booking: dict) -> tuple[Optional[str], Optional[str]]:
        """
        Extract date (YYYY-MM-DD) and time (HH:MM) in IST (UTC+5:30) from a booking row.
        """
        slot_date = None
        slot_time = None

        slot_start = booking.get("slot_start") or ""
        if slot_start:
            try:
                # Handle ISO timestamps like 2026-09-10T12:00:00+00:00 or 2026-09-10T17:30:00+05:30
                clean_iso = slot_start.replace("Z", "+00:00")
                dt = datetime.fromisoformat(clean_iso)
                if dt.tzinfo is None:
                    # Treat naive as IST if from CallMedex slot builder
                    dt = dt.replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
                # Convert to IST
                ist_tz = timezone(timedelta(hours=5, minutes=30))
                dt_ist = dt.astimezone(ist_tz)
                slot_date = dt_ist.strftime("%Y-%m-%d")
                slot_time = dt_ist.strftime("%H:%M")
            except Exception as e:
                logger.debug(f"Could not parse slot_start {slot_start}: {e}")

        # Fallback 1: slot_id format: provider_id|date|time
        if (not slot_date or not slot_time) and booking.get("slot_id") and "|" in str(booking.get("slot_id")):
            parts = str(booking.get("slot_id")).split("|")
            if len(parts) >= 2 and len(parts[1]) == 10:
                slot_date = parts[1]
            if len(parts) >= 3 and ":" in parts[2]:
                slot_time = parts[2]

        # Fallback 2: preferred_date or booking_date
        if not slot_date:
            if booking.get("preferred_date"):
                slot_date = str(booking.get("preferred_date"))[:10]
            elif booking.get("booking_date"):
                slot_date = str(booking.get("booking_date"))[:10]

        if not slot_time and booking.get("slot_time"):
            slot_time = str(booking.get("slot_time"))[:5]

        return slot_date, slot_time

    @classmethod
    async def run_appointment_alerts_pass(cls, target_date_ist: Optional[str] = None) -> Dict[str, Any]:
        """
        Scan for confirmed appointments scheduled for today (in IST) that have not
        received their day-of reminder yet, and dispatch notifications to both
        the patient and the assigned doctor.
        """
        if not supabase:
            return {"status": "skipped", "reason": "No database connection", "sent_count": 0}

        now_utc = datetime.now(timezone.utc)
        ist_now = now_utc + timedelta(hours=5, minutes=30)
        today_ist_str = target_date_ist or ist_now.strftime("%Y-%m-%d")
        now_iso = now_utc.isoformat()

        try:
            # Query confirmed bookings that haven't been reminded
            res = (
                supabase.table("bookings")
                .select("*")
                .eq("status", "confirmed")
                .eq("reminder_sent", False)
                .execute()
            )
            candidates = res.data or []
            if not candidates:
                return {"status": "success", "sent_count": 0, "date": today_ist_str}

            sent_count = 0
            for b in candidates:
                b_id = b.get("id")
                if not b_id:
                    continue

                slot_date, slot_time = cls.resolve_slot_datetime_ist(b)
                if not slot_date or slot_date != today_ist_str:
                    # Not scheduled for today
                    continue

                display_time = f"{slot_time} IST" if slot_time else "today"
                service_title = (b.get("service_type") or "consultation").replace("_", " ").title()

                patient_id = b.get("patient_id")
                provider_id = b.get("provider_id")

                # 1. Resolve Patient Info
                patient_name = "Patient"
                patient_email = None
                if patient_id:
                    try:
                        p_res = supabase.table("users").select("id, full_name, email").eq("id", patient_id).limit(1).execute()
                        if p_res.data:
                            patient_name = p_res.data[0].get("full_name") or "Patient"
                            patient_email = p_res.data[0].get("email")
                    except Exception as p_err:
                        logger.debug(f"Patient lookup error: {p_err}")

                # 2. Resolve Doctor / Provider Info
                doctor_name = "Dr. CallMedex Consultant"
                doctor_user_id = provider_id
                doctor_email = None
                if provider_id:
                    try:
                        d_res = supabase.table("users").select("id, full_name, email, role").eq("id", provider_id).limit(1).execute()
                        if d_res.data:
                            doctor_name = d_res.data[0].get("full_name") or doctor_name
                            doctor_email = d_res.data[0].get("email")
                        else:
                            # Could be doctors table id
                            doc_entry = supabase.table("doctors").select("id, user_id, name").eq("id", provider_id).limit(1).execute()
                            if doc_entry.data and doc_entry.data[0].get("user_id"):
                                doctor_user_id = doc_entry.data[0]["user_id"]
                                u_entry = supabase.table("users").select("id, full_name, email").eq("id", doctor_user_id).limit(1).execute()
                                if u_entry.data:
                                    doctor_name = u_entry.data[0].get("full_name") or doc_entry.data[0].get("name") or doctor_name
                                    doctor_email = u_entry.data[0].get("email")
                    except Exception as d_err:
                        logger.debug(f"Doctor lookup error: {d_err}")

                if not doctor_name.lower().startswith("dr.") and not doctor_name.lower().startswith("dr "):
                    display_doc_name = f"Dr. {doctor_name}"
                else:
                    display_doc_name = doctor_name

                # 3. Dispatch Patient Alert (In-App & Push)
                if patient_id:
                    p_title = f"🗓️ Appointment Today: {display_doc_name} at {display_time}"
                    p_body = (
                        f"Your {service_title} with {display_doc_name} is scheduled for today at {display_time}. "
                        f"Tap here to open your consultation room and join."
                    )
                    try:
                        await NotificationEngine.send_multi(
                            user_id=patient_id,
                            channels=["in_app", "push"],
                            title=p_title,
                            body=p_body,
                            data={
                                "booking_id": b_id,
                                "type": "appointment_day_alert",
                                "provider_id": provider_id,
                                "doctor_name": display_doc_name,
                                "slot_time": slot_time,
                                "action_url": f"/consultation/{provider_id}?booking_id={b_id}&name={doctor_name}"
                            }
                        )
                    except Exception as p_notify_err:
                        logger.warning(f"Failed to alert patient for booking {b_id}: {p_notify_err}")

                # 4. Dispatch Doctor Alert (In-App & Push)
                if doctor_user_id:
                    d_title = f"🩺 Appointment Today: {patient_name} at {display_time}"
                    d_body = (
                        f"Clinical {service_title} scheduled with patient {patient_name} today at {display_time}. "
                        f"Your exam room and e-Prescription cockpit are ready."
                    )
                    try:
                        await NotificationEngine.send_multi(
                            user_id=doctor_user_id,
                            channels=["in_app", "push"],
                            title=d_title,
                            body=d_body,
                            data={
                                "booking_id": b_id,
                                "type": "doctor_appointment_alert",
                                "patient_id": patient_id,
                                "patient_name": patient_name,
                                "slot_time": slot_time,
                                "action_url": f"/dashboard/doctor/consult/{b_id}"
                            }
                        )
                    except Exception as d_notify_err:
                        logger.warning(f"Failed to alert doctor for booking {b_id}: {d_notify_err}")

                # 5. Mark as reminded in bookings
                try:
                    supabase.table("bookings").update({
                        "reminder_sent": True,
                        "reminder_sent_at": now_iso,
                        "updated_at": now_iso,
                    }).eq("id", b_id).execute()
                    sent_count += 1
                except Exception as up_err:
                    logger.warning(f"Could not update reminder_sent for {b_id}: {up_err}")

            logger.info(f"Appointment alert pass completed for {today_ist_str}: {sent_count} booking(s) alerted.")
            return {"status": "success", "sent_count": sent_count, "date": today_ist_str}

        except Exception as e:
            logger.error(f"run_appointment_alerts_pass failed: {e}")
            return {"status": "error", "error": str(e), "sent_count": 0}

    @classmethod
    async def send_consultation_ready_ping(cls, booking_id: str, sender_user_id: str, sender_role: str) -> Dict[str, Any]:
        """
        Allow either doctor or patient to ping the other party when entering
        the exam / waiting room to expedite teleconsultation start.
        """
        if not supabase:
            return {"success": False, "error": "Database offline"}

        try:
            b_res = supabase.table("bookings").select("*").eq("id", booking_id).limit(1).execute()
            if not b_res.data:
                return {"success": False, "error": "Booking not found"}
            b = b_res.data[0]

            patient_id = b.get("patient_id")
            provider_id = b.get("provider_id")

            # Resolve doctor user id if provider_id is from doctors table
            doctor_user_id = provider_id
            if provider_id:
                try:
                    u_chk = supabase.table("users").select("id").eq("id", provider_id).limit(1).execute()
                    if not u_chk.data:
                        d_chk = supabase.table("doctors").select("user_id").eq("id", provider_id).limit(1).execute()
                        if d_chk.data and d_chk.data[0].get("user_id"):
                            doctor_user_id = d_chk.data[0]["user_id"]
                except Exception:
                    pass

            now_iso = datetime.now(timezone.utc).isoformat()

            if sender_role in ("doctor", "provider"):
                # Doctor pings Patient: "Doctor is in exam room"
                doc_name = "Your Doctor"
                d_user = supabase.table("users").select("full_name").eq("id", sender_user_id).limit(1).execute()
                if d_user.data and d_user.data[0].get("full_name"):
                    doc_name = f"Dr. {d_user.data[0]['full_name']}"

                title = f"🔔 {doc_name} is Waiting in Exam Room"
                body = f"{doc_name} is online and ready for your consultation. Tap here to join now!"
                target_user = patient_id
                action_url = f"/consultation/{provider_id}?booking_id={booking_id}"
            else:
                # Patient pings Doctor: "Patient has joined waiting lobby"
                pat_name = "Patient"
                p_user = supabase.table("users").select("full_name").eq("id", sender_user_id).limit(1).execute()
                if p_user.data and p_user.data[0].get("full_name"):
                    pat_name = p_user.data[0]["full_name"]

                title = f"🔔 {pat_name} has Joined the Consultation Room"
                body = f"{pat_name} is online and ready in the teleconsultation waiting lobby."
                target_user = doctor_user_id
                action_url = f"/dashboard/doctor/consult/{booking_id}"

            if target_user:
                await NotificationEngine.send_multi(
                    user_id=target_user,
                    channels=["in_app", "push"],
                    title=title,
                    body=body,
                    data={
                        "booking_id": booking_id,
                        "type": "telemed_ready_ping",
                        "sender_id": sender_user_id,
                        "action_url": action_url,
                        "timestamp": now_iso
                    }
                )
                return {"success": True, "message": "Notification dispatched to other party"}
            else:
                return {"success": False, "error": "Target recipient could not be resolved"}

        except Exception as e:
            logger.error(f"send_consultation_ready_ping error: {e}")
            return {"success": False, "error": str(e)}
