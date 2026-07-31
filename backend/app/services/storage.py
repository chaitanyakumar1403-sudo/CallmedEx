"""Supabase Storage helper for verification documents (private bucket)."""
import uuid
import logging
from app.database import supabase
from app.config import settings

logger = logging.getLogger(__name__)

# Allowed file signatures (magic bytes) mapped to extensions
# Only these file types are accepted for verification document uploads.
ALLOWED_SIGNATURES = {
    b"\xff\xd8\xff": ".jpg",       # JPEG
    b"\x89PNG\r\n\x1a\n": ".png",  # PNG
    b"%PDF-": ".pdf",              # PDF
    b"PK\x03\x04": ".zip",        # ZIP (multi-document uploads)
}

MAX_SIGNATURE_LEN = max(len(sig) for sig in ALLOWED_SIGNATURES)


def validate_magic_bytes(file_bytes: bytes, claimed_ext: str) -> bool:
    """
    Validate file content by its magic bytes, not just the Content-Type header.

    Returns True if the file's actual bytes match the claimed extension.
    Rejects files whose content doesn't match their declared type.
    """
    if not file_bytes or len(file_bytes) < 4:
        return False

    ext = claimed_ext.lower().lstrip(".")

    for signature, expected_ext in ALLOWED_SIGNATURES.items():
        if file_bytes[:len(signature)] == signature:
            return f".{ext}" == expected_ext

    return False


class StorageService:
    @staticmethod
    def upload_verification_doc(user_id: str, file_bytes: bytes, ext: str) -> str:
        """Upload to private bucket; return object path, or '' on failure."""
        if not supabase:
            return ""

        # Validate file content by magic bytes before upload
        if not validate_magic_bytes(file_bytes, ext):
            logger.warning(
                f"Upload rejected: file magic bytes do not match claimed extension "
                f"'{ext}' for user {user_id}"
            )
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
