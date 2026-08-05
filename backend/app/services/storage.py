"""Supabase Storage helper for verification documents (private bucket)."""
import ipaddress
import socket
import uuid
import logging
import urllib.error
import urllib.request
from urllib.parse import urlparse
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

# ── SSRF guard for download_document's URL branch ───────────────────────────
# The only legitimate caller passes a signed URL that Supabase itself issued
# (via signed_url() below) for our own project — never a value a patient/
# provider can set directly. Still, report_jobs.source_document_url is a
# plain text column, so treat it as untrusted: restrict fetches to our own
# Supabase project host and reject anything that resolves to a private/
# loopback/link-local/reserved address (blocks cloud-metadata and internal-
# network SSRF targets even if the host check is ever misconfigured).
_ALLOWED_DOWNLOAD_HOSTS = set()
if settings.SUPABASE_URL:
    _supabase_host = (urlparse(settings.SUPABASE_URL).hostname or "").lower()
    if _supabase_host:
        _ALLOWED_DOWNLOAD_HOSTS.add(_supabase_host)


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Fail closed on any redirect — never follow a 3xx to an unvalidated host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.URLError(f"Refusing to follow redirect to {newurl!r}")


def _validate_download_url(url: str) -> None:
    """Raise ValueError if `url` is not safe to fetch server-side (SSRF guard)."""
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"only https URLs are permitted, got scheme={parsed.scheme!r}")

    host = (parsed.hostname or "").rstrip(".").lower()
    if not host:
        raise ValueError("URL has no hostname")

    if _ALLOWED_DOWNLOAD_HOSTS and host not in _ALLOWED_DOWNLOAD_HOSTS:
        raise ValueError(f"host {host!r} is not an allowed storage host")

    try:
        addrinfo = socket.getaddrinfo(host, None)
    except socket.gaierror as e:
        raise ValueError(f"could not resolve host {host!r}: {e}")

    for family, _, _, _, sockaddr in addrinfo:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ValueError(f"host {host!r} resolves to a blocked address {ip}")


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
    def upload_document(user_id: str, file_bytes: bytes, ext: str, bucket: str = None) -> str:
        """Upload to `bucket` (defaults to the private verification bucket);
        return the object path, or '' on failure."""
        bucket = bucket or settings.VERIFICATION_BUCKET
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
            supabase.storage.from_(bucket).upload(
                path, file_bytes,
                {"contentType": "application/octet-stream", "upsert": "false"},
            )
            return path
        except Exception as e:
            err_msg = str(e).lower()
            if "bucket not found" in err_msg or "404" in err_msg:
                logger.warning(f"Bucket '{bucket}' not found in Supabase Storage. Auto-creating...")
                try:
                    supabase.storage.create_bucket(bucket, options={"public": False})
                    supabase.storage.from_(bucket).upload(
                        path, file_bytes,
                        {"contentType": "application/octet-stream", "upsert": "false"},
                    )
                    return path
                except Exception as retry_err:
                    logger.error(f"Storage upload retry failed after bucket creation: {retry_err}")
                    return ""
            logger.error(f"Storage upload failed: {e}")
            return ""

    @staticmethod
    def upload_verification_doc(user_id: str, file_bytes: bytes, ext: str) -> str:
        """Thin wrapper kept for every existing verification-flow caller."""
        return StorageService.upload_document(user_id, file_bytes, ext, bucket=settings.VERIFICATION_BUCKET)

    @staticmethod
    def download_document(source: str, bucket: str = None) -> bytes:
        """Download raw bytes for `source`.

        `source` may be either a full signed URL (as returned by
        signed_url()) or a raw storage object path (as returned by
        upload_document()) — callers such as report_submission.py's
        MediAssist-fallback path pass whatever they were given without
        knowing which shape it is. Defaults to REPORTS_BUCKET since lab
        report documents are the only current caller.

        Returns b"" on failure, mirroring upload_document/signed_url's
        empty-string-on-failure convention.
        """
        if not source:
            return b""

        if source.startswith("http://") or source.startswith("https://"):
            try:
                _validate_download_url(source)
            except ValueError as e:
                logger.error(f"Blocked unsafe document download URL: {e}")
                return b""
            try:
                opener = urllib.request.build_opener(_NoRedirectHandler)
                with opener.open(source, timeout=30) as resp:
                    return resp.read()
            except Exception as e:
                logger.error(f"Document download via URL failed: {e}")
                return b""

        bucket = bucket or settings.REPORTS_BUCKET
        if not supabase:
            return b""
        try:
            return supabase.storage.from_(bucket).download(source)
        except Exception as e:
            logger.error(f"Document download from storage path '{source}' failed: {e}")
            return b""

    @staticmethod
    def signed_url(path: str, expires: int = 3600, bucket: str = None) -> str:
        bucket = bucket or settings.VERIFICATION_BUCKET
        if not supabase or not path:
            return ""
        try:
            res = supabase.storage.from_(bucket).create_signed_url(path, expires)
            return res.get("signedURL") or res.get("signedUrl") or ""
        except Exception as e:
            logger.error(f"Signed URL failed: {e}")
            return ""
