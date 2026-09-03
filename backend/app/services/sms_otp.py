"""
SMS OTP Service — Production-grade MSG91 SendOTP & Rate-Limited Verification
Supports:
  - Phone normalization (+91 E.164 and 10-digit Indian numbers)
  - Rate limiting (max 5 sends per hour per number)
  - Brute-force lockout (5 failed attempts locks verification for 15 min)
  - MSG91 REST API v5 integration (DLT-registered template support)
  - Seamless mock / dev mode fallback when MSG91_AUTH_KEY is not configured
  - Pluggable provider adapter interface (SMSOTPProvider)
"""
import abc
import hashlib
import hmac
import logging
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
import httpx
from fastapi import HTTPException
from app.config import settings

logger = logging.getLogger(__name__)

# Constants
MAX_OTP_SENDS_PER_HOUR = 5
MAX_VERIFICATION_ATTEMPTS = 5
OTP_EXPIRY_MINUTES = 5
LOCKOUT_MINUTES = 15

# Local in-memory caches for rate-limiting, test OTPs, and lockout tracking
# Key: normalized phone string -> dict
_otp_cache = {}
_send_rate_cache = {}  # phone -> list of timestamps
_lockout_cache = {}   # phone -> locked_until datetime


def normalize_indian_phone(phone: str) -> str:
    """
    Normalize phone number into standard E.164 format for India (+91XXXXXXXXXX).
    Accepts:
      - '9876543210' -> '+919876543210'
      - '09876543210' -> '+919876543210'
      - '919876543210' -> '+919876543210'
      - '+919876543210' -> '+919876543210'
      - '+91 98765 43210' -> '+919876543210'
    """
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required.")
    
    # Strip all non-digit characters except leading '+'
    clean = re.sub(r"[^\d+]", "", phone.strip())
    if clean.startswith("+"):
        clean = clean[1:]
    
    if len(clean) == 10:
        return f"+91{clean}"
    elif len(clean) == 11 and clean.startswith("0"):
        return f"+91{clean[1:]}"
    elif len(clean) == 12 and clean.startswith("91"):
        return f"+{clean}"
    elif len(clean) > 10:
        return f"+{clean}"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phone number format: '{phone}'. Must be a valid 10-digit mobile number.",
        )


def _hash_code(code: str) -> str:
    """Generate SHA-256 hash for secure storage."""
    return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()


class SMSOTPProvider(abc.ABC):
    """Abstract interface for SMS OTP delivery & verification providers."""

    @abc.abstractmethod
    async def send_otp(self, phone: str, otp_code: str) -> bool:
        """Send OTP code to normalized phone number."""
        pass

    @abc.abstractmethod
    async def verify_otp(self, phone: str, user_otp: str) -> bool:
        """Verify the user-provided OTP code."""
        pass


class MSG91OTPProvider(SMSOTPProvider):
    """
    Production MSG91 SendOTP API Provider.
    Calls MSG91 v5 OTP API when MSG91_AUTH_KEY is configured.
    Falls back cleanly to secure local verification in development / test environments.
    """

    MSG91_SEND_URL = "https://control.msg91.com/api/v5/otp"
    MSG91_VERIFY_URL = "https://control.msg91.com/api/v5/otp/verify"

    def __init__(self):
        self.auth_key = settings.MSG91_AUTH_KEY.strip()
        self.template_id = settings.MSG91_TEMPLATE_ID.strip()
        self.sender_id = settings.MSG91_SENDER_ID.strip() or "CLMDEX"
        self.otp_length = settings.MSG91_OTP_LENGTH or 6
        self.expiry_minutes = settings.MSG91_OTP_EXPIRY_MINUTES or 5

    def is_live(self) -> bool:
        return bool(self.auth_key)

    async def send_otp(self, phone: str, otp_code: str) -> bool:
        """Send OTP via MSG91 API or local fallback."""
        if not self.is_live():
            if settings.APP_ENV == "development" and settings.OTP_PROVIDER == "mock":
                logger.info(f"[SMS_OTP:DEV] Simulated SMS OTP to {phone}: Code={otp_code} (APP_ENV=development, OTP_PROVIDER=mock)")
                return True
            else:
                logger.error(f"[SMS_OTP] MSG91 credentials not configured (APP_ENV={settings.APP_ENV}, OTP_PROVIDER={settings.OTP_PROVIDER})")
                raise HTTPException(
                    status_code=503,
                    detail="SMS OTP delivery is currently unavailable. OTP provider is not configured for this environment."
                )

        # MSG91 expects mobile number without '+' prefix (e.g. 919876543210)
        formatted_mobile = phone.lstrip("+")
        params = {
            "template_id": self.template_id,
            "mobile": formatted_mobile,
            "authkey": self.auth_key,
            "otp": otp_code,
            "otp_length": self.otp_length,
            "otp_expiry": self.expiry_minutes,
        }
        if self.sender_id:
            params["sender"] = self.sender_id

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self.MSG91_SEND_URL, params=params)
                data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                
                if response.status_code == 200 and data.get("type") != "error":
                    logger.info(f"[SMS_OTP:MSG91] Successfully sent OTP to {phone}")
                    return True
                else:
                    err_msg = data.get("message", response.text)
                    logger.error(f"[SMS_OTP:MSG91] MSG91 API Error ({response.status_code}): {err_msg}")
                    return False
        except Exception as e:
            logger.exception(f"[SMS_OTP:MSG91] Connection failed when sending OTP to {phone}: {e}")
            return False

    async def verify_otp(self, phone: str, user_otp: str) -> bool:
        """Verify OTP with MSG91 API or local fallback."""
        if not self.is_live():
            if settings.APP_ENV == "development" and settings.OTP_PROVIDER == "mock":
                return True
            raise HTTPException(
                status_code=503,
                detail="SMS OTP verification is currently unavailable. OTP provider is not configured for this environment."
            )

        formatted_mobile = phone.lstrip("+")
        params = {
            "mobile": formatted_mobile,
            "otp": user_otp.strip(),
            "authkey": self.auth_key,
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(self.MSG91_VERIFY_URL, params=params)
                data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                if response.status_code == 200 and data.get("type") == "success":
                    return True
                logger.warning(f"[SMS_OTP:MSG91] Verify failed on MSG91: {data.get('message')}")
                return False
        except Exception as e:
            logger.error(f"[SMS_OTP:MSG91] MSG91 verify API request failed: {e}")
            return False


class SMSOTPService:
    """
    High-level OTP Service enforcing rate-limits, expiry, lockout, and provider dispatch.
    """

    def __init__(self, provider: Optional[SMSOTPProvider] = None):
        self.provider = provider or MSG91OTPProvider()

    def _check_send_rate_limit(self, phone: str):
        """Enforce maximum OTP requests per hour."""
        now = datetime.now(timezone.utc)
        one_hour_ago = now - timedelta(hours=1)
        
        # Clean older entries
        recent_sends = [ts for ts in _send_rate_cache.get(phone, []) if ts > one_hour_ago]
        _send_rate_cache[phone] = recent_sends

        if len(recent_sends) >= MAX_OTP_SENDS_PER_HOUR:
            raise HTTPException(
                status_code=429,
                detail=f"Too many OTP requests. Maximum {MAX_OTP_SENDS_PER_HOUR} requests per hour allowed. Please try again later.",
            )

    def _check_lockout(self, phone: str):
        """Check if phone number is locked due to too many failed attempts."""
        locked_until = _lockout_cache.get(phone)
        if locked_until:
            now = datetime.now(timezone.utc)
            if now < locked_until:
                remaining_sec = int((locked_until - now).total_seconds())
                minutes = (remaining_sec // 60) + 1
                raise HTTPException(
                    status_code=423,
                    detail=f"Too many failed OTP attempts. Account verification locked for {minutes} more minute(s).",
                )
            else:
                _lockout_cache.pop(phone, None)

    async def send_otp(self, phone_raw: str) -> dict:
        """
        Generate, store, and dispatch a 6-digit OTP code to the given phone number.
        """
        phone = normalize_indian_phone(phone_raw)
        self._check_send_rate_limit(phone)
        self._check_lockout(phone)

        # Generate secure 6-digit code
        otp_code = "".join([str(secrets.randbelow(10)) for _ in range(6)])
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)

        # Store in cache
        _otp_cache[phone] = {
            "otp_hash": _hash_code(otp_code),
            "created_at": now,
            "expires_at": expires_at,
            "attempts": 0,
            "raw_code": otp_code if not isinstance(self.provider, MSG91OTPProvider) or not self.provider.is_live() else None
        }

        # Track send rate
        _send_rate_cache.setdefault(phone, []).append(now)

        # Dispatch via provider
        success = await self.provider.send_otp(phone, otp_code)
        if not success:
            raise HTTPException(status_code=502, detail="Failed to deliver OTP SMS. Please try again.")

        is_dev_mock = settings.APP_ENV == "development" and settings.OTP_PROVIDER == "mock"

        return {
            "phone": phone,
            "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
            "message": f"OTP sent successfully to {phone[:6]}****{phone[-2:]}",
            "dev_otp": otp_code if is_dev_mock else None
        }

    async def verify_otp(self, phone_raw: str, user_otp: str) -> bool:
        """
        Verify the OTP code with expiry check, attempt tracking, and lockout.
        """
        phone = normalize_indian_phone(phone_raw)
        self._check_lockout(phone)

        record = _otp_cache.get(phone)
        if not record:
            raise HTTPException(
                status_code=400,
                detail="No active OTP found for this phone number. Please request a new OTP.",
            )

        now = datetime.now(timezone.utc)
        if now > record["expires_at"]:
            _otp_cache.pop(phone, None)
            raise HTTPException(
                status_code=400,
                detail="OTP has expired. Please request a new OTP code.",
            )

        # Verify either against local hash or provider
        user_hash = _hash_code(user_otp)
        is_valid = hmac.compare_digest(record["otp_hash"], user_hash)

        # Support test OTP bypass strictly in development mock mode
        if not is_valid and user_otp.strip() == "000000" and settings.APP_ENV == "development" and settings.OTP_PROVIDER == "mock":
            is_valid = True

        if not is_valid:
            record["attempts"] += 1
            remaining = MAX_VERIFICATION_ATTEMPTS - record["attempts"]
            if remaining <= 0:
                _lockout_cache[phone] = now + timedelta(minutes=LOCKOUT_MINUTES)
                _otp_cache.pop(phone, None)
                raise HTTPException(
                    status_code=423,
                    detail=f"Too many failed OTP attempts. Locked for {LOCKOUT_MINUTES} minutes.",
                )
            raise HTTPException(
                status_code=400,
                detail=f"Invalid OTP code. {remaining} attempt(s) remaining.",
            )

        # Verification succeeded: clean up OTP from cache
        _otp_cache.pop(phone, None)
        return True


# Singleton instance
sms_otp_service = SMSOTPService()


# ─── Transactional (non-OTP) SMS ──────────────────────────────────────────

MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow/"


async def send_transactional_sms(phone: str, body: str) -> dict:
    """Send a notification SMS through MSG91's Flow API.

    Separate from the OTP path above because MSG91's OTP endpoint only
    accepts an OTP template and cannot carry notification text.

    India's DLT regime forbids free-form transactional SMS: the content must
    match a template registered with the operator. MSG91_FLOW_ID names that
    registered template and the message text is passed as its VAR1, so the
    approved template reads like "CallMedex: ##VAR1##". Register the template
    first — sending against an unregistered one is rejected by the operator,
    not by us.

    Returns a result dict rather than raising; a failed notification must
    never take down the booking or dispatch it was announcing.
    """
    auth_key = (settings.MSG91_AUTH_KEY or "").strip()
    flow_id = (getattr(settings, "MSG91_FLOW_ID", "") or "").strip()

    if not auth_key or not flow_id:
        return {
            "success": False,
            "error": "MSG91 transactional SMS not configured (MSG91_AUTH_KEY / MSG91_FLOW_ID)",
        }

    try:
        mobile = normalize_indian_phone(phone).lstrip("+")
    except HTTPException as e:
        return {"success": False, "error": f"Unusable phone number: {e.detail}"}

    payload = {
        "template_id": flow_id,
        "short_url": "0",
        "recipients": [{"mobiles": mobile, "VAR1": body}],
    }
    headers = {"authkey": auth_key, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(MSG91_FLOW_URL, json=payload, headers=headers)
    except Exception as e:
        logger.warning(f"[SMS] MSG91 flow request failed: {e}")
        return {"success": False, "error": f"MSG91 transport error: {e}"}

    try:
        data = resp.json()
    except Exception:
        data = {}

    # MSG91 answers 200 with {"type": "error"} on a rejected send, so the
    # status code alone is not proof of delivery.
    if resp.status_code == 200 and data.get("type") != "error":
        logger.info(f"[SMS] Delivered notification SMS to {mobile}")
        return {"success": True}

    err = data.get("message") or resp.text[:160]
    logger.warning(f"[SMS] MSG91 rejected notification SMS ({resp.status_code}): {err}")
    return {"success": False, "error": f"MSG91: {err}"}
