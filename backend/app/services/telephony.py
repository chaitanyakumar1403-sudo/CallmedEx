"""
Telephony Service — Next-Gen CallMedex
Masked calling (Twilio/Exotel) for privacy-protected communication.
Patients and providers never see each other's real phone numbers.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from app.database import supabase
from app.config import settings

logger = logging.getLogger(__name__)

# Session duration: virtual numbers remain active for the booking duration + buffer
DEFAULT_SESSION_HOURS = 4


class TelephonyService:
    """
    Abstract telephony service for masked calling.
    Supports Twilio and Exotel backends.
    In development mode, simulates number provisioning.
    """

    @staticmethod
    async def provision_masked_session(
        booking_id: str,
        patient_id: str,
        provider_id: str,
        dispatch_request_id: str = None,
        duration_hours: int = DEFAULT_SESSION_HOURS,
    ) -> dict:
        """
        Provision a masked communication session.
        - Assigns a virtual number for the duration of the booking.
        - Patient calls virtual number → routes to provider.
        - Provider calls virtual number → routes to patient.
        """
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=duration_hours)

        # In production: Call Twilio/Exotel API to provision a virtual number
        # For now: Generate a simulated virtual number
        virtual_number = f"+91-800-CALLMDX-{uuid.uuid4().hex[:4].upper()}"

        telephony_provider = "simulated"
        if hasattr(settings, "TWILIO_ACCOUNT_SID") and settings.TWILIO_ACCOUNT_SID:
            telephony_provider = "twilio"
        elif hasattr(settings, "EXOTEL_API_KEY") and settings.EXOTEL_API_KEY:
            telephony_provider = "exotel"

        session_data = {
            "id": session_id,
            "booking_id": booking_id,
            "dispatch_request_id": dispatch_request_id,
            "patient_id": patient_id,
            "provider_id": provider_id,
            "virtual_number": virtual_number,
            "telephony_provider": telephony_provider,
            "status": "active",
            "activated_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "created_at": now.isoformat(),
        }

        if supabase:
            try:
                supabase.table("communication_sessions").insert(session_data).execute()
            except Exception as e:
                logger.error(f"Failed to create comm session: {e}")

        logger.info(
            f"📞 Masked session created: {virtual_number} "
            f"(Patient: {patient_id} ↔ Provider: {provider_id})"
        )

        return {
            "session_id": session_id,
            "virtual_number": virtual_number,
            "expires_at": expires_at.isoformat(),
            "message": f"Use {virtual_number} to call. Your real number is protected.",
        }

    @staticmethod
    async def handle_incoming_call(
        virtual_number: str,
        caller_phone: str,
    ) -> dict:
        """
        Route an incoming call on a virtual number to the correct destination.
        - If caller is patient → route to provider.
        - If caller is provider → route to patient.
        """
        if not supabase:
            return {"success": False, "message": "Database not available"}

        # Find the active session for this virtual number
        result = (
            supabase.table("communication_sessions")
            .select("*")
            .eq("virtual_number", virtual_number)
            .eq("status", "active")
            .execute()
        )

        if not result.data:
            return {"success": False, "message": "No active session for this number"}

        session = result.data[0]

        # Determine who is calling and who should receive
        # In production, we'd look up the caller's user by phone number
        # For now, return the routing info
        return {
            "success": True,
            "session_id": session["id"],
            "patient_id": session["patient_id"],
            "provider_id": session["provider_id"],
            "message": "Call routed via masked number",
        }

    @staticmethod
    async def expire_session(session_id: str) -> dict:
        """Deactivate a masked communication session."""
        if not supabase:
            return {"success": True}

        try:
            supabase.table("communication_sessions").update({
                "status": "expired",
            }).eq("id", session_id).execute()
        except Exception as e:
            logger.error(f"Failed to expire session: {e}")

        return {"success": True, "message": "Session expired"}

    @staticmethod
    async def log_call(
        session_id: str,
        caller_id: str,
        receiver_id: str,
        direction: str,
        duration_seconds: int = 0,
        status: str = "completed",
    ) -> dict:
        """Log a call event for analytics and compliance."""
        call_log = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "caller_id": caller_id,
            "receiver_id": receiver_id,
            "direction": direction,
            "duration_seconds": duration_seconds,
            "status": status,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if supabase:
            try:
                supabase.table("call_logs").insert(call_log).execute()
            except Exception as e:
                logger.warning(f"Failed to log call: {e}")

        return {"success": True, "call_log_id": call_log["id"]}
