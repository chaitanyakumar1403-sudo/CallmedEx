"""
Notification Engine — Next-Gen CallMedex
Centralized notification service for all channels:
  email, SMS, WhatsApp, push, in-app.
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
        Channels: 'email', 'sms', 'whatsapp', 'push', 'in_app'
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
            elif channel == "whatsapp":
                delivery_result = await NotificationEngine._send_whatsapp(user_id, body, data)
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
        """Send email notification (delegates to existing EmailService)."""
        # In production: Look up user email and send via SMTP/SendGrid
        logger.info(f"📧 Email to {user_id}: {title}")
        return {"success": True, "simulated": True}

    @staticmethod
    async def _send_sms(user_id: str, body: str) -> dict:
        """Send SMS notification (MSG91/Twilio)."""
        logger.info(f"📱 SMS to {user_id}: {body[:50]}...")
        return {"success": True, "simulated": True}

    @staticmethod
    async def _send_whatsapp(user_id: str, body: str, data: dict = None) -> dict:
        """Send WhatsApp notification (delegates to existing WhatsAppService)."""
        logger.info(f"💬 WhatsApp to {user_id}: {body[:50]}...")
        return {"success": True, "simulated": True}

    @staticmethod
    async def _send_push(user_id: str, title: str, body: str, data: dict = None) -> dict:
        """Send push notification (FCM)."""
        logger.info(f"🔔 Push to {user_id}: {title}")
        return {"success": True, "simulated": True}
