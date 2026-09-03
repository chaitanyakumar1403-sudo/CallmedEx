"""
Notification Engine — Next-Gen CallMedex
Centralized notification service for CallMedex-owned channels:
  email, SMS, push, in-app.
WhatsApp is not a channel here — CallMedex never sends WhatsApp messages
directly; that is MediAssist AI's exclusive responsibility, reached via
app.integrations.mediassist_client (see docs/integrations/mediassist-ai/).
Every notification is logged for audit and analytics.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from app.database import supabase

logger = logging.getLogger(__name__)


class NotificationEngine:
    """
    Centralized notification dispatcher.
    Routes notifications to the correct channel and records delivery status.
    """

    @staticmethod
    async def send(
        user_id: str,
        channel: str,
        title: str,
        body: str,
        data: dict = None,
    ) -> dict:
        """
        Send a notification via the specified channel.
        Channels: 'email', 'sms', 'push', 'in_app'
        WhatsApp is not handled here — it is sent exclusively via
        app.integrations.mediassist_client (MediAssist AI owns all WhatsApp
        delivery; see docs/integrations/mediassist-ai/).
        """
        notification_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        notification_record = {
            "id": notification_id,
            "user_id": user_id,
            "channel": channel,
            "title": title,
            "body": body,
            "data": data or {},
            "status": "pending",
            "created_at": now,
        }

        # Route to the correct channel handler
        delivery_result = None
        try:
            if channel == "email":
                delivery_result = await NotificationEngine._send_email(user_id, title, body, data)
            elif channel == "sms":
                delivery_result = await NotificationEngine._send_sms(user_id, body)
            elif channel == "push":
                delivery_result = await NotificationEngine._send_push(user_id, title, body, data)
            elif channel == "in_app":
                delivery_result = {"success": True}  # Just store in DB
            else:
                delivery_result = {"success": False, "error": f"Unknown channel: {channel}"}

            if delivery_result.get("success"):
                notification_record["status"] = "sent"
                notification_record["sent_at"] = now
            else:
                notification_record["status"] = "failed"
                notification_record["error_message"] = delivery_result.get("error", "Unknown error")

        except Exception as e:
            notification_record["status"] = "failed"
            notification_record["error_message"] = str(e)
            logger.error(f"Notification failed: {e}")

        # Store in database
        if supabase:
            try:
                supabase.table("notifications").insert(notification_record).execute()
            except Exception as e:
                logger.warning(f"Failed to log notification: {e}")

        logger.info(f"📬 Notification [{channel}] to user {user_id}: {title} — {notification_record['status']}")

        return {
            "notification_id": notification_id,
            "channel": channel,
            "status": notification_record["status"],
        }

    @staticmethod
    async def send_multi(
        user_id: str,
        channels: list,
        title: str,
        body: str,
        data: dict = None,
    ) -> list:
        """Send the same notification across multiple channels."""
        results = []
        for channel in channels:
            result = await NotificationEngine.send(user_id, channel, title, body, data)
            results.append(result)
        return results

    @staticmethod
    async def get_user_notifications(
        user_id: str,
        limit: int = 50,
        unread_only: bool = False,
    ) -> list:
        """Get notifications for a user (for in-app notification center)."""
        if not supabase:
            return []

        query = (
            supabase.table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
        )
        if unread_only:
            query = query.neq("status", "read")

        result = query.execute()
        return result.data or []

    @staticmethod
    async def mark_read(notification_id: str, user_id: str) -> dict:
        """Mark a notification as read."""
        if not supabase:
            return {"success": True}

        now = datetime.now(timezone.utc).isoformat()
        supabase.table("notifications").update({
            "status": "read",
            "read_at": now,
        }).eq("id", notification_id).eq("user_id", user_id).execute()

        return {"success": True}

    # ─── Channel Handlers ─────────────────────────────────────────────

    @staticmethod
    async def _send_email(user_id: str, title: str, body: str, data: dict = None) -> dict:
        """Send email notification via EmailService to the user's registered email."""
        if not supabase:
            logger.warning(f"📧 Email to {user_id}: {title} — DB unavailable, simulated")
            return {"success": True, "simulated": True}

        try:
            user_row = (
                supabase.table("users").select("email, full_name")
                .eq("id", user_id).limit(1).execute()
            )
            if not user_row.data or not user_row.data[0].get("email"):
                logger.warning(
                    f"📧 Email to {user_id}: {title} — user has no email on file"
                )
                return {"success": False, "error": "No email address on file for user"}

            to_email = user_row.data[0]["email"]

            # Build a simple HTML notification email
            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px;">
                    <h2 style="color: #1e293b;">{title}</h2>
                    <p style="color: #374151; font-size: 16px; white-space: pre-wrap;">{body}</p>
                </div>
            </body>
            </html>
            """
            from app.services.email import EmailService
            sent = EmailService._send_real_email(to_email, title, html_content, body)
            if sent:
                return {"success": True}
            else:
                logger.warning(
                    f"📧 Email to {user_id} ({to_email}): {title} — "
                    f"delivery failed (RESEND_API_KEY/SMTP not configured)"
                )
                return {"success": False, "error": "Email delivery failed"}
        except Exception as e:
            logger.error(f"📧 Email to {user_id} failed: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    async def _send_sms(user_id: str, body: str) -> dict:
        """Send SMS notification (MSG91/Twilio).

        Goes through MSG91's Flow API (app/services/sms_otp.py), which is the
        DLT-compliant path for notification text — the OTP endpoint cannot
        carry it. Needs MSG91_FLOW_ID pointing at a registered template.

        Reports honest failure: recording status "sent" for a message nobody
        received makes the notifications table lie, and ops then sees 100%
        delivery on a channel that delivered nothing.
        """
        from app.services.sms_otp import send_transactional_sms

        phone = None
        if supabase and user_id:
            try:
                res = (
                    supabase.table("users").select("mobile")
                    .eq("id", user_id).limit(1).execute()
                )
                if res.data:
                    phone = res.data[0].get("mobile")
            except Exception as e:
                logger.warning(f"Could not look up mobile for {user_id}: {e}")

        if not phone:
            logger.warning(f"📱 SMS to {user_id}: no mobile number on file")
            return {"success": False, "error": "No mobile number on file for user"}

        result = await send_transactional_sms(phone, body)
        if not result.get("success"):
            logger.warning(
                f"📱 SMS to {user_id}: NOT DELIVERED — {result.get('error')}"
            )
        return {"success": result.get("success", False), "error": result.get("error")}

    @staticmethod
    async def _send_push(user_id: str, title: str, body: str, data: dict = None) -> dict:
        """Send push notification via FCM HTTP v1 (app/services/push.py).

        The Android channel comes from `data["channel_id"]` when the caller
        names one, so a dispatch offer lands on the max-importance channel
        rather than the quiet default. Failure stays honest — an unconfigured
        or undelivered push records as `failed`, never `sent`.
        """
        from app.services import push as push_service

        channel_id = (data or {}).get("channel_id") or push_service.CHANNEL_APPOINTMENTS
        result = await push_service.send_to_user(
            user_id=user_id,
            title=title,
            body=body,
            data=data,
            channel_id=channel_id,
        )
        return {
            "success": result["success"],
            "error": result.get("error"),
            "delivered": result.get("delivered", 0),
        }
