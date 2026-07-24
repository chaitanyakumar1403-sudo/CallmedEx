"""Supabase Storage helper for verification documents (private bucket)."""
import uuid
import logging
from app.database import supabase
from app.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    @staticmethod
    def upload_verification_doc(user_id: str, file_bytes: bytes, ext: str) -> str:
        """Upload to private bucket; return object path, or '' on failure."""
        if not supabase:
            return ""
        path = f"{user_id}/{uuid.uuid4().hex}.{ext.lstrip('.')}"
        try:
            supabase.storage.from_(settings.VERIFICATION_BUCKET).upload(
                path, file_bytes,
                {"contentType": "application/octet-stream", "upsert": "false"},
            )
            return path
        except Exception as e:
            logger.error(f"Storage upload failed: {e}")
            return ""

    @staticmethod
    def signed_url(path: str, expires: int = 3600) -> str:
        if not supabase or not path:
            return ""
        try:
            res = supabase.storage.from_(settings.VERIFICATION_BUCKET).create_signed_url(path, expires)
            return res.get("signedURL") or res.get("signedUrl") or ""
        except Exception as e:
            logger.error(f"Signed URL failed: {e}")
            return ""
