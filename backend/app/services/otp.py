"""
OTP Service — In-App OTP Verification for Home Visits
Generates and verifies 6-digit OTP codes for dispatch services.
Patient sees OTP on their tracking screen → tells it verbally to provider.
Backend is ready for SMS integration later.
"""
import random
import logging
from datetime import datetime, timezone, timedelta
from app.database import supabase

logger = logging.getLogger(__name__)

# In-memory OTP store for local dev (when no Supabase)
_local_otps: dict = {}  # dispatch_id -> {"otp": str, "created_at": datetime, "verified": bool}

OTP_EXPIRY_MINUTES = 10


class OTPService:
    """Manages OTP generation and verification for dispatch services."""

    @staticmethod
    def generate_otp(dispatch_id: str) -> str:
        """Generate a 6-digit OTP for a dispatch and store it."""
        otp = str(random.randint(100000, 999999))
        now = datetime.now(timezone.utc)

        if supabase:
            try:
                # Store OTP in the dispatch_requests row
                supabase.table("dispatch_requests").update({
                    "verification_otp": otp,
                    "otp_generated_at": now.isoformat(),
                    "otp_verified": False,
                }).eq("id", dispatch_id).execute()
                logger.info(f"OTP generated for dispatch {dispatch_id}")
            except Exception as e:
                logger.error(f"Failed to store OTP in DB: {e}")
                # Fallback to in-memory
                _local_otps[dispatch_id] = {
                    "otp": otp,
                    "created_at": now,
                    "verified": False,
                }
        else:
            _local_otps[dispatch_id] = {
                "otp": otp,
                "created_at": now,
                "verified": False,
            }

        return otp

    @staticmethod
    def verify_otp(dispatch_id: str, entered_otp: str) -> dict:
        """Verify the OTP entered by the provider."""
        now = datetime.now(timezone.utc)

        if supabase:
            try:
                result = (
                    supabase.table("dispatch_requests")
                    .select("verification_otp, otp_generated_at, otp_verified")
                    .eq("id", dispatch_id)
                    .execute()
                )
                if not result.data:
                    return {"success": False, "error": "Dispatch not found"}

                record = result.data[0]
                stored_otp = record.get("verification_otp")
                generated_at_str = record.get("otp_generated_at")
                already_verified = record.get("otp_verified", False)

                if already_verified:
                    return {"success": False, "error": "OTP already verified"}

                if not stored_otp:
                    return {"success": False, "error": "No OTP generated for this dispatch"}

                # Check expiry
                if generated_at_str:
                    generated_at = datetime.fromisoformat(generated_at_str.replace("Z", "+00:00"))
                    if (now - generated_at) > timedelta(minutes=OTP_EXPIRY_MINUTES):
                        return {"success": False, "error": "OTP expired. Please request a new one."}

                if stored_otp != entered_otp:
                    return {"success": False, "error": "Invalid OTP. Please try again."}

                # Mark as verified
                supabase.table("dispatch_requests").update({
                    "otp_verified": True,
                    "otp_verified_at": now.isoformat(),
                }).eq("id", dispatch_id).execute()

                return {"success": True, "message": "OTP verified successfully"}

            except Exception as e:
                logger.error(f"OTP verification DB error: {e}")
                # Fallback to in-memory
                return OTPService._verify_local(dispatch_id, entered_otp, now)
        else:
            return OTPService._verify_local(dispatch_id, entered_otp, now)

    @staticmethod
    def _verify_local(dispatch_id: str, entered_otp: str, now: datetime) -> dict:
        """In-memory OTP verification for local dev."""
        otp_data = _local_otps.get(dispatch_id)
        if not otp_data:
            return {"success": False, "error": "No OTP found for this dispatch"}

        if otp_data.get("verified"):
            return {"success": False, "error": "OTP already verified"}

        # Check expiry
        if (now - otp_data["created_at"]) > timedelta(minutes=OTP_EXPIRY_MINUTES):
            return {"success": False, "error": "OTP expired. Please request a new one."}

        if otp_data["otp"] != entered_otp:
            return {"success": False, "error": "Invalid OTP. Please try again."}

        otp_data["verified"] = True
        return {"success": True, "message": "OTP verified successfully"}

    @staticmethod
    def get_patient_otp(dispatch_id: str) -> dict:
        """Get the OTP to display to the patient (in-app display)."""
        if supabase:
            try:
                result = (
                    supabase.table("dispatch_requests")
                    .select("verification_otp, otp_verified, status")
                    .eq("id", dispatch_id)
                    .execute()
                )
                if not result.data:
                    return {"success": False, "error": "Dispatch not found"}

                record = result.data[0]
                otp = record.get("verification_otp")
                verified = record.get("otp_verified", False)
                status = record.get("status", "")

                # Only show OTP when provider has arrived
                if status not in ("arrived", "in_progress"):
                    return {
                        "success": True,
                        "otp": None,
                        "message": "OTP will be generated when your provider arrives",
                        "verified": verified,
                    }

                return {
                    "success": True,
                    "otp": otp if not verified else None,
                    "verified": verified,
                    "message": "Share this OTP with your provider" if not verified else "OTP verified ✅",
                }
            except Exception as e:
                logger.error(f"Get patient OTP error: {e}")
                return OTPService._get_local_otp(dispatch_id)
        else:
            return OTPService._get_local_otp(dispatch_id)

    @staticmethod
    def _get_local_otp(dispatch_id: str) -> dict:
        """Get OTP from in-memory store."""
        otp_data = _local_otps.get(dispatch_id)
        if not otp_data:
            return {"success": True, "otp": None, "message": "OTP will be generated when provider arrives", "verified": False}

        return {
            "success": True,
            "otp": otp_data["otp"] if not otp_data.get("verified") else None,
            "verified": otp_data.get("verified", False),
            "message": "Share this OTP with your provider" if not otp_data.get("verified") else "OTP verified ✅",
        }
