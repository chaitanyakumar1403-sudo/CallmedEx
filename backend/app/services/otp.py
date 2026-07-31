"""
OTP Service — In-App OTP Verification for Home Visits
Generates and verifies 6-digit OTP codes for dispatch services.
Patient sees OTP on their tracking screen → tells it verbally to provider.
Backend is ready for SMS integration later.

Security: OTPs are hashed with SHA-256 before storage, and verification
attempts are rate-limited (5 attempts per dispatch_id, then lockout for 15 min).
"""
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta
from app.database import supabase

logger = logging.getLogger(__name__)

# In-memory OTP store for local dev (when no Supabase)
_local_otps: dict = {}  # dispatch_id -> {"otp_hash": str, "created_at": datetime, "verified": bool, "attempts": int, "locked_until": datetime | None}

OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 5
OTP_LOCKOUT_MINUTES = 15


def _hash_otp(otp: str) -> str:
    """Hash an OTP with SHA-256 for secure storage."""
    return hashlib.sha256(otp.encode()).hexdigest()


def _parse_iso_datetime(value: str) -> datetime | None:
    """
    Robustly parse an ISO datetime string, handling various timezone formats.
    Returns a timezone-aware UTC datetime, or None if unparseable.
    """
    if not value:
        return None
    try:
        s = str(value).strip()
        # Handle various ISO formats
        for fmt in (
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%f+00:00",
            "%Y-%m-%dT%H:%M:%S+00:00",
        ):
            try:
                dt = datetime.strptime(s, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)
            except ValueError:
                continue
        # Last resort: fromisoformat with Z replacement
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


class OTPService:
    """Manages OTP generation and verification for dispatch services."""

    @staticmethod
    def generate_otp(dispatch_id: str) -> str:
        """Generate a 6-digit OTP for a dispatch and store it (hashed)."""
        otp = str(secrets.randbelow(900000) + 100000)  # cryptographically secure
        otp_hash = _hash_otp(otp)
        now = datetime.now(timezone.utc)

        if supabase:
            try:
                # Store OTP HASH in the dispatch_requests row (not plaintext)
                supabase.table("dispatch_requests").update({
                    "verification_otp": otp_hash,
                    "otp_generated_at": now.isoformat(),
                    "otp_verified": False,
                    "otp_attempts": 0,
                    "otp_locked_until": None,
                }).eq("id", dispatch_id).execute()
                logger.info(f"OTP generated for dispatch {dispatch_id}")
            except Exception as e:
                logger.error(f"Failed to store OTP in DB: {e}")
                # Fallback to in-memory
                _local_otps[dispatch_id] = {
                    "otp_hash": otp_hash,
                    "created_at": now,
                    "verified": False,
                    "attempts": 0,
                    "locked_until": None,
                }
        else:
            _local_otps[dispatch_id] = {
                "otp_hash": otp_hash,
                "created_at": now,
                "verified": False,
                "attempts": 0,
                "locked_until": None,
            }

        return otp

    @staticmethod
    def verify_otp(dispatch_id: str, entered_otp: str) -> dict:
        """Verify the OTP entered by the provider with brute-force protection."""
        now = datetime.now(timezone.utc)
        entered_hash = _hash_otp(entered_otp)

        if supabase:
            try:
                result = (
                    supabase.table("dispatch_requests")
                    .select("verification_otp, otp_generated_at, otp_verified, otp_attempts, otp_locked_until")
                    .eq("id", dispatch_id)
                    .execute()
                )
                if not result.data:
                    return {"success": False, "error": "Dispatch not found"}

                record = result.data[0]
                stored_hash = record.get("verification_otp")
                generated_at_str = record.get("otp_generated_at")
                already_verified = record.get("otp_verified", False)
                attempts = record.get("otp_attempts", 0)
                locked_until_str = record.get("otp_locked_until")

                if already_verified:
                    return {"success": False, "error": "OTP already verified"}

                # Check lockout
                if locked_until_str:
                    locked_until = _parse_iso_datetime(str(locked_until_str))
                    if locked_until and now < locked_until:
                        remaining = int((locked_until - now).total_seconds())
                        return {
                            "success": False,
                            "error": f"Too many attempts. Please wait {remaining} seconds before trying again.",
                            "locked_until": locked_until.isoformat(),
                        }

                if not stored_hash:
                    return {"success": False, "error": "No OTP generated for this dispatch"}

                # Check expiry
                if generated_at_str:
                    generated_at = _parse_iso_datetime(str(generated_at_str))
                    if generated_at and (now - generated_at) > timedelta(minutes=OTP_EXPIRY_MINUTES):
                        return {"success": False, "error": "OTP expired. Please request a new one."}

                # Compare hashes
                if stored_hash != entered_hash:
                    new_attempts = attempts + 1
                    update_data = {"otp_attempts": new_attempts}

                    if new_attempts >= MAX_OTP_ATTEMPTS:
                        lockout_until = now + timedelta(minutes=OTP_LOCKOUT_MINUTES)
                        update_data["otp_locked_until"] = lockout_until.isoformat()
                        supabase.table("dispatch_requests").update(update_data).eq("id", dispatch_id).execute()
                        return {
                            "success": False,
                            "error": f"Too many failed attempts. Account locked for {OTP_LOCKOUT_MINUTES} minutes.",
                            "locked_until": lockout_until.isoformat(),
                        }

                    supabase.table("dispatch_requests").update(update_data).eq("id", dispatch_id).execute()
                    remaining = MAX_OTP_ATTEMPTS - new_attempts
                    return {"success": False, "error": f"Invalid OTP. {remaining} attempt(s) remaining."}

                # Mark as verified
                supabase.table("dispatch_requests").update({
                    "otp_verified": True,
                    "otp_verified_at": now.isoformat(),
                }).eq("id", dispatch_id).execute()

                return {"success": True, "message": "OTP verified successfully"}

            except Exception as e:
                logger.error(f"OTP verification DB error: {e}")
                return OTPService._verify_local(dispatch_id, entered_otp, now)
        else:
            return OTPService._verify_local(dispatch_id, entered_otp, now)

    @staticmethod
    def _verify_local(dispatch_id: str, entered_otp: str, now: datetime) -> dict:
        """In-memory OTP verification for local dev with brute-force protection."""
        otp_data = _local_otps.get(dispatch_id)
        if not otp_data:
            return {"success": False, "error": "No OTP found for this dispatch"}

        if otp_data.get("verified"):
            return {"success": False, "error": "OTP already verified"}

        # Check lockout
        locked_until = otp_data.get("locked_until")
        if locked_until and now < locked_until:
            remaining = int((locked_until - now).total_seconds())
            return {
                "success": False,
                "error": f"Too many attempts. Please wait {remaining} seconds.",
            }

        # Check expiry
        if (now - otp_data["created_at"]) > timedelta(minutes=OTP_EXPIRY_MINUTES):
            return {"success": False, "error": "OTP expired. Please request a new one."}

        entered_hash = _hash_otp(entered_otp)
        if otp_data["otp_hash"] != entered_hash:
            otp_data["attempts"] = otp_data.get("attempts", 0) + 1
            if otp_data["attempts"] >= MAX_OTP_ATTEMPTS:
                otp_data["locked_until"] = now + timedelta(minutes=OTP_LOCKOUT_MINUTES)
                return {
                    "success": False,
                    "error": f"Too many failed attempts. Locked for {OTP_LOCKOUT_MINUTES} minutes.",
                }
            remaining = MAX_OTP_ATTEMPTS - otp_data["attempts"]
            return {"success": False, "error": f"Invalid OTP. {remaining} attempt(s) remaining."}

        otp_data["verified"] = True
        return {"success": True, "message": "OTP verified successfully"}

    @staticmethod
    def get_patient_otp(dispatch_id: str) -> dict:
        """
        Get the OTP status for the patient's tracking screen.
        NOTE: The plaintext OTP is only returned at generation time.
        This endpoint returns whether the OTP is verified and active,
        but does NOT return the plaintext OTP (it's stored as a hash).
        The patient already has the OTP from the generate_otp response.
        """
        if supabase:
            try:
                result = (
                    supabase.table("dispatch_requests")
                    .select("otp_verified, otp_generated_at, status, otp_attempts, otp_locked_until")
                    .eq("id", dispatch_id)
                    .execute()
                )
                if not result.data:
                    return {"success": False, "error": "Dispatch not found"}

                record = result.data[0]
                verified = record.get("otp_verified", False)
                status = record.get("status", "")
                generated_at = record.get("otp_generated_at")
                attempts = record.get("otp_attempts", 0)
                locked_until = record.get("otp_locked_until")

                # Only show OTP status when provider has arrived
                if status not in ("arrived", "in_progress"):
                    return {
                        "success": True,
                        "otp_active": False,
                        "message": "OTP will be generated when your provider arrives",
                        "verified": verified,
                    }

                # Check if OTP is expired
                expired = False
                if generated_at:
                    gen_time = _parse_iso_datetime(str(generated_at))
                    if gen_time:
                        expired = (datetime.now(timezone.utc) - gen_time) > timedelta(minutes=OTP_EXPIRY_MINUTES)

                return {
                    "success": True,
                    "otp_active": not verified and not expired,
                    "verified": verified,
                    "expired": expired,
                    "attempts_used": attempts,
                    "locked": locked_until is not None,
                    "message": (
                        "OTP verified ✅" if verified
                        else "OTP expired. Please request a new one." if expired
                        else "Share the OTP with your provider"
                    ),
                }
            except Exception as e:
                logger.error(f"Get patient OTP error: {e}")
                return OTPService._get_local_otp(dispatch_id)
        else:
            return OTPService._get_local_otp(dispatch_id)

    @staticmethod
    def _get_local_otp(dispatch_id: str) -> dict:
        """Get OTP status from in-memory store."""
        otp_data = _local_otps.get(dispatch_id)
        if not otp_data:
            return {"success": True, "otp_active": False, "message": "OTP will be generated when provider arrives", "verified": False}

        verified = otp_data.get("verified", False)
        now = datetime.now(timezone.utc)
        expired = (now - otp_data["created_at"]) > timedelta(minutes=OTP_EXPIRY_MINUTES)

        return {
            "success": True,
            "otp_active": not verified and not expired,
            "verified": verified,
            "expired": expired,
            "attempts_used": otp_data.get("attempts", 0),
            "locked": otp_data.get("locked_until") is not None,
            "message": "OTP verified ✅" if verified else "Share the OTP with your provider",
        }
