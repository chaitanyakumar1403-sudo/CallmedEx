"""
Security Middleware — Phase 7A
Enterprise-grade security for CallMedex:
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Request size limiting
- Input sanitization
- Request ID tracking for log correlation
"""
import uuid
import re
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

logger = logging.getLogger(__name__)

# ─── Dangerous patterns to sanitize ──────────────────────────────────────
SQL_INJECTION_PATTERNS = [
    r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC|EXECUTE|UNION|TRUNCATE)\b.*\b(FROM|INTO|TABLE|SET|WHERE|ALL)\b)",
    r"(--|;|/\*|\*/|@@|@)",
    r"(\b(OR|AND)\b\s+\d+\s*=\s*\d+)",
]

XSS_PATTERNS = [
    r"<script[^>]*>",
    r"javascript:",
    r"on\w+\s*=",
    r"<iframe",
    r"<object",
    r"<embed",
    r"<form",
    r"eval\(",
    r"document\.cookie",
    r"document\.location",
]

# Max request body size: 10 MB
MAX_REQUEST_SIZE = 10 * 1024 * 1024


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    All-in-one security middleware.
    Adds security headers, validates request size, and tracks requests.
    """

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # ── Generate Request ID ──────────────────────────────────────
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        # ── Check Request Size ───────────────────────────────────────
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body too large. Maximum size is 10 MB."},
            )

        # ── Process Request ──────────────────────────────────────────
        try:
            response = await call_next(request)
        except Exception as e:
            logger.error(f"[{request_id}] Unhandled error: {e}", exc_info=True)
            origin = request.headers.get("origin", "*")
            return JSONResponse(
                status_code=500,
                content={"detail": f"An internal error occurred: {str(e)}"},
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Methods": "*",
                    "X-Request-ID": request_id,
                },
            )

        # ── Add Security Headers ─────────────────────────────────────
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(self), geolocation=(self), "
            "payment=(self), usb=(), magnetometer=()"
        )
        # HSTS — enforce HTTPS (only in production)
        if not request.url.hostname in ("localhost", "127.0.0.1"):
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Content-Security-Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://maps.googleapis.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https: blob:; "
            "connect-src 'self' https://*.supabase.co https://api.razorpay.com https://nominatim.openstreetmap.org wss://*.supabase.co; "
            "frame-src https://api.razorpay.com https://checkout.razorpay.com; "
            "object-src 'none'; "
            "base-uri 'self'"
        )

        # ── Log Request ──────────────────────────────────────────────
        duration = round((time.time() - start_time) * 1000, 1)
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} → {response.status_code} ({duration}ms)"
        )

        return response


def sanitize_input(value: str) -> str:
    """
    Sanitize a string input by stripping dangerous SQL and XSS patterns.
    Use this on all user-provided text fields before processing.
    """
    if not isinstance(value, str):
        return value

    cleaned = value.strip()

    # Check for SQL injection patterns
    for pattern in SQL_INJECTION_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            logger.warning(f"SQL injection pattern detected and stripped: {cleaned[:100]}")
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    # Check for XSS patterns
    for pattern in XSS_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            logger.warning(f"XSS pattern detected and stripped: {cleaned[:100]}")
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    # Strip null bytes
    cleaned = cleaned.replace("\x00", "")

    return cleaned.strip()


def sanitize_dict(data: dict) -> dict:
    """Recursively sanitize all string values in a dictionary."""
    sanitized = {}
    for key, value in data.items():
        if isinstance(value, str):
            sanitized[key] = sanitize_input(value)
        elif isinstance(value, dict):
            sanitized[key] = sanitize_dict(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_input(v) if isinstance(v, str)
                else sanitize_dict(v) if isinstance(v, dict)
                else v
                for v in value
            ]
        else:
            sanitized[key] = value
    return sanitized
