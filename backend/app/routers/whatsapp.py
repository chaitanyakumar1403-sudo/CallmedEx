"""
WhatsApp Webhook Router — Phase 2
Dual front-door: same backend serves both website and WhatsApp.
Per claude.md Section 5: booking initiation, appointment reminders,
phlebotomist arrival notifications, report delivery.

Uses Meta WhatsApp Cloud API via ZukoLabs' existing FastAPI stack.
"""
import hmac
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.config import settings
from app.database import supabase

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])


# ─── Models ───────────────────────────────────────────────────────────────

class WhatsAppMessage(BaseModel):
    to: str  # Phone number with country code
    template_name: Optional[str] = None
    template_params: Optional[list] = None
    text: Optional[str] = None
    type: str = "text"  # text, template, interactive


class SendMessageRequest(BaseModel):
    phone: str
    message_type: str  # booking_confirmation, phleb_assigned, report_ready, reminder
    data: dict = {}


# ─── WhatsApp Cloud API Helpers ────────────────────────────────────────────

class WhatsAppService:
    """
    WhatsApp Cloud API integration via Meta's official API.
    Handles both incoming webhooks and outbound messaging.
    """
    BASE_URL = "https://graph.facebook.com/v18.0"

    @staticmethod
    def get_api_url():
        phone_id = settings.WHATSAPP_PHONE_ID
        return f"{WhatsAppService.BASE_URL}/{phone_id}/messages"

    @staticmethod
    async def send_text_message(to: str, text: str) -> dict:
        """Send a plain text WhatsApp message."""
        if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_ID:
            return {
                "success": False,
                "message": "WhatsApp not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID missing)",
                "simulated": True,
                "to": to,
                "text": text,
            }

        # PRODUCTION: Use httpx or aiohttp to POST to Meta API
        # For now, return simulated success
        return {
            "success": True,
            "simulated": True,
            "to": to,
            "text": text,
            "message": "Message sent (simulated — configure WHATSAPP_TOKEN for live)",
        }

    @staticmethod
    async def send_template_message(to: str, template_name: str, params: list = None) -> dict:
        """Send a template-based WhatsApp message."""
        if not settings.WHATSAPP_TOKEN:
            return {
                "success": False,
                "simulated": True,
                "template": template_name,
                "to": to,
            }

        return {
            "success": True,
            "simulated": True,
            "to": to,
            "template": template_name,
            "params": params,
        }

    @staticmethod
    async def send_booking_confirmation(phone: str, booking_data: dict) -> dict:
        """Send booking confirmation via WhatsApp."""
        text = (
            f"✅ *Booking Confirmed — CallMedex*\n\n"
            f"📋 *Service:* {booking_data.get('service_type', 'Diagnostic Test')}\n"
            f"🏥 *Center:* {booking_data.get('provider_name', 'N/A')}\n"
            f"📅 *Date:* {booking_data.get('date', 'N/A')}\n"
            f"⏰ *Time:* {booking_data.get('time', 'N/A')}\n"
            f"🆔 *Booking ID:* {booking_data.get('booking_id', 'N/A')}\n\n"
            f"📍 Track your booking: https://callmedex.com/track/{booking_data.get('booking_id', '')}\n\n"
            f"_Reply CANCEL to cancel • RESCHEDULE to reschedule_"
        )
        return await WhatsAppService.send_text_message(phone, text)

    @staticmethod
    async def send_phlebotomist_assigned(phone: str, dispatch_data: dict) -> dict:
        """Notify patient that a phlebotomist has been assigned."""
        text = (
            f"🩸 *Phlebotomist Assigned — CallMedex*\n\n"
            f"👤 *Name:* {dispatch_data.get('phleb_name', 'N/A')}\n"
            f"📞 *Contact:* {dispatch_data.get('phleb_phone', 'N/A')}\n"
            f"📍 *Distance:* {dispatch_data.get('distance_km', 'N/A')} km\n"
            f"⏱ *ETA:* ~{dispatch_data.get('eta_minutes', 'N/A')} minutes\n\n"
            f"🗺 Track live: https://callmedex.com/track/{dispatch_data.get('dispatch_id', '')}\n\n"
            f"_Your phlebotomist is on the way!_"
        )
        return await WhatsAppService.send_text_message(phone, text)

    @staticmethod
    async def send_report_ready(phone: str, report_data: dict) -> dict:
        """Notify patient that their lab report is ready."""
        text = (
            f"📊 *Lab Report Ready — CallMedex*\n\n"
            f"📋 *Test:* {report_data.get('test_name', 'Diagnostic Test')}\n"
            f"🏥 *Lab:* {report_data.get('lab_name', 'N/A')}\n"
            f"📅 *Date:* {report_data.get('date', 'N/A')}\n\n"
            f"📥 View Report: https://callmedex.com/reports/{report_data.get('report_id', '')}\n\n"
        )

        if report_data.get("abnormal_flags"):
            text += f"⚠️ *Abnormal values detected:* {', '.join(report_data['abnormal_flags'])}\n"
            text += "_Please consult your doctor for interpretation._\n\n"

        text += "_Your report has been saved to your ABHA health records._"
        return await WhatsAppService.send_text_message(phone, text)

    @staticmethod
    async def send_appointment_reminder(phone: str, booking_data: dict) -> dict:
        """Send appointment reminder 30 minutes before."""
        text = (
            f"⏰ *Appointment Reminder — CallMedex*\n\n"
            f"Your appointment is in *30 minutes*!\n\n"
            f"📋 *Service:* {booking_data.get('service_type', 'N/A')}\n"
            f"🏥 *Center:* {booking_data.get('provider_name', 'N/A')}\n"
            f"⏰ *Time:* {booking_data.get('time', 'N/A')}\n\n"
            f"_Reply CANCEL to cancel • RESCHEDULE to reschedule_"
        )
        return await WhatsAppService.send_text_message(phone, text)


# ─── Incoming Webhook (from Meta) ─────────────────────────────────────────

@router.get("/webhook")
async def verify_webhook(request: Request):
    """
    Meta webhook verification endpoint.
    Meta sends a GET with hub.mode, hub.verify_token, hub.challenge.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    # Use WHATSAPP_TOKEN as verify token for simplicity
    verify_token = settings.WHATSAPP_TOKEN or "callmedex-webhook-verify"

    if mode == "subscribe" and token == verify_token:
        return int(challenge)

    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def receive_webhook(request: Request):
    """
    Receive incoming WhatsApp messages and status updates from Meta.
    Processes: text messages, interactive button responses, message status.
    """
    body = await request.json()

    # Extract message data
    try:
        entry = body.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        statuses = value.get("statuses", [])
    except (IndexError, KeyError):
        return {"status": "ok"}

    # Process incoming messages
    for msg in messages:
        sender = msg.get("from", "")
        msg_type = msg.get("type", "")
        msg_id = msg.get("id", "")

        if msg_type == "text":
            text = msg.get("text", {}).get("body", "").strip().lower()
            await _handle_text_message(sender, text, msg_id)

        elif msg_type == "interactive":
            interactive = msg.get("interactive", {})
            button_reply = interactive.get("button_reply", {})
            button_id = button_reply.get("id", "")
            await _handle_button_response(sender, button_id, msg_id)

    # Process status updates
    for status in statuses:
        # Log delivery/read receipts for analytics
        pass

    return {"status": "ok"}


async def _handle_text_message(sender: str, text: str, msg_id: str):
    """
    Handle incoming text messages with intent detection.
    Basic keyword matching for MVP — will be upgraded to Groq/Llama NLU.
    """
    # Normalize Indian phone format
    phone = sender if sender.startswith("+") else f"+{sender}"

    if text in ("hi", "hello", "hey", "start"):
        await WhatsAppService.send_text_message(
            phone,
            "👋 *Welcome to CallMedex!*\n\n"
            "I can help you with:\n"
            "1️⃣ *Book a test* — Type 'book'\n"
            "2️⃣ *My bookings* — Type 'bookings'\n"
            "3️⃣ *Link ABHA* — Type 'abha'\n"
            "4️⃣ *Talk to support* — Type 'help'\n\n"
            "_Powered by ZukoLabs 🫀_"
        )

    elif text in ("book", "test", "book test", "book a test"):
        await WhatsAppService.send_text_message(
            phone,
            "🔬 *Book a Diagnostic Test*\n\n"
            "To book, visit:\n"
            "👉 https://callmedex.com/booking\n\n"
            "Or reply with:\n"
            "• *CBC* — Complete Blood Count (₹199)\n"
            "• *THYROID* — Thyroid Profile (₹399)\n"
            "• *SUGAR* — Fasting Blood Sugar (₹79)\n"
            "• *FULL* — Comprehensive Wellness (₹1,999)\n\n"
            "_Home collection available!_"
        )

    elif text in ("bookings", "my bookings", "appointments"):
        await WhatsAppService.send_text_message(
            phone,
            "📋 *Your Bookings*\n\n"
            "View all your bookings at:\n"
            "👉 https://callmedex.com/dashboard/patient\n\n"
            "_Login required for security._"
        )

    elif text in ("abha", "link abha", "health id"):
        await WhatsAppService.send_text_message(
            phone,
            "🔗 *Link Your ABHA*\n\n"
            "Connect your Ayushman Bharat Health Account to access your complete health history.\n\n"
            "👉 https://callmedex.com/dashboard/patient\n\n"
            "_Go to Dashboard → Link ABHA Account_"
        )

    elif text in ("cancel", "cancel booking"):
        await WhatsAppService.send_text_message(
            phone,
            "❌ *Cancel Booking*\n\n"
            "To cancel a booking, visit:\n"
            "👉 https://callmedex.com/dashboard/patient\n\n"
            "_Select the booking and tap Cancel._"
        )

    elif text in ("help", "support", "contact"):
        await WhatsAppService.send_text_message(
            phone,
            "🆘 *Need Help?*\n\n"
            "📞 Call: 1800-XXX-XXXX (toll-free)\n"
            "📧 Email: support@callmedex.com\n"
            "🌐 Web: https://callmedex.com\n\n"
            "_Available 24/7 for healthcare emergencies._"
        )

    else:
        await WhatsAppService.send_text_message(
            phone,
            f"🤔 I didn't understand that.\n\n"
            "Try:\n"
            "• *book* — Book a test\n"
            "• *bookings* — View your bookings\n"
            "• *help* — Get support\n\n"
            "_Or visit https://callmedex.com_"
        )


async def _handle_button_response(sender: str, button_id: str, msg_id: str):
    """Handle interactive button responses."""
    phone = sender if sender.startswith("+") else f"+{sender}"

    if button_id == "book_test":
        await WhatsAppService.send_text_message(phone, "🔬 Opening booking flow...")
    elif button_id == "my_bookings":
        await WhatsAppService.send_text_message(phone, "📋 Fetching your bookings...")
    elif button_id == "link_abha":
        await WhatsAppService.send_text_message(phone, "🔗 Starting ABHA linkage...")


# ─── Outbound Messaging API ──────────────────────────────────────────────

@router.post("/send")
async def send_message(
    req: SendMessageRequest,
):
    """
    Internal API to send WhatsApp messages triggered by platform events.
    Called by booking/dispatch/report services when events occur.
    """
    if req.message_type == "booking_confirmation":
        result = await WhatsAppService.send_booking_confirmation(req.phone, req.data)
    elif req.message_type == "phleb_assigned":
        result = await WhatsAppService.send_phlebotomist_assigned(req.phone, req.data)
    elif req.message_type == "report_ready":
        result = await WhatsAppService.send_report_ready(req.phone, req.data)
    elif req.message_type == "reminder":
        result = await WhatsAppService.send_appointment_reminder(req.phone, req.data)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown message type: {req.message_type}")

    return result
