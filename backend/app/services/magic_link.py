import jwt
import time
from typing import Dict, Any, Optional
from app.config import settings

class MagicLinkService:
    """
    Handles secure generation and decoding of magic link tokens.
    Used for email dispatch workflows so providers can accept/decline
    without logging into the platform.
    """

    @staticmethod
    def generate_token(offer_id: str, provider_id: str, expiration_minutes: int = 5) -> str:
        """
        Generates a short-lived JWT token containing the dispatch offer details.
        """
        payload = {
            "offer_id": offer_id,
            "provider_id": provider_id,
            "exp": int(time.time()) + (expiration_minutes * 60),
            "iat": int(time.time()),
            "type": "magic_dispatch"
        }
        return jwt.encode(payload, settings.MAGIC_LINK_SECRET, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def decode_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Decodes and verifies a magic link token.
        Returns None if expired, invalid, or wrong type.
        """
        try:
            payload = jwt.decode(token, settings.MAGIC_LINK_SECRET, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("type") != "magic_dispatch":
                return None
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    @staticmethod
    def generate_task_session_token(dispatch_id: str, provider_id: str, expiration_hours: int = 12) -> str:
        """
        Generates a token used solely for interacting with a specific active dispatch task 
        (e.g., marking arrived, entering OTP, completing). 
        Used by the lightweight Magic Email tracking UI.
        """
        payload = {
            "dispatch_id": dispatch_id,
            "provider_id": provider_id,
            "exp": int(time.time()) + (expiration_hours * 3600),
            "iat": int(time.time()),
            "type": "task_session"
        }
        return jwt.encode(payload, settings.MAGIC_LINK_SECRET, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def decode_task_session_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Decodes a task session token.
        """
        try:
            payload = jwt.decode(token, settings.MAGIC_LINK_SECRET, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("type") != "task_session":
                return None
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    @staticmethod
    def generate_guardian_token(booking_id: str, patient_id: str, expiration_hours: int = 12) -> str:
        """
        Generates a token for Guardian Link live tracking (§8.2).
        Shareable with family to track visit in real time without login.
        """
        payload = {
            "booking_id": booking_id,
            "patient_id": patient_id,
            "exp": int(time.time()) + (expiration_hours * 3600),
            "iat": int(time.time()),
            "type": "guardian_link",
        }
        return jwt.encode(payload, settings.MAGIC_LINK_SECRET, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def decode_guardian_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Decodes and verifies a Guardian Link token.
        """
        try:
            payload = jwt.decode(token, settings.MAGIC_LINK_SECRET, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("type") != "guardian_link":
                return None
            return payload
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return None

    @staticmethod
    def generate_handoff_token(patient_id: str, scopes: list, expiration_minutes: int = 15) -> str:
        """
        Generates a 15-minute token for Doctor Handoff QR (§8.3).
        """
        payload = {
            "patient_id": patient_id,
            "scopes": scopes,
            "exp": int(time.time()) + (expiration_minutes * 60),
            "iat": int(time.time()),
            "type": "doctor_handoff",
        }
        return jwt.encode(payload, settings.MAGIC_LINK_SECRET, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def decode_handoff_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Decodes a Doctor Handoff QR token.
        """
        try:
            payload = jwt.decode(token, settings.MAGIC_LINK_SECRET, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("type") != "doctor_handoff":
                return None
            return payload
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return None

