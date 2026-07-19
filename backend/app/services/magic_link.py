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
        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def decode_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Decodes and verifies a magic link token.
        Returns None if expired, invalid, or wrong type.
        """
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
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
        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def decode_task_session_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Decodes a task session token.
        """
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("type") != "task_session":
                return None
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
