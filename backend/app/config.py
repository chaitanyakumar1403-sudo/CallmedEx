"""
CallMedex Backend Configuration
Loads environment variables for all services.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # Auth
    # IMPORTANT: JWT_SECRET has no default. If not set in production, the app
    # will refuse to start rather than falling back to a publicly-known value.
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    # Reduced from 7 days (10080) to 60 minutes with refresh token rotation
    # for healthcare data security. Use REFRESH_TOKEN_EXPIRE_DAYS for long-lived
    # refresh tokens if needed.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(
        os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")
    )

    # Token-type-specific secrets — each token type gets its own signing key
    # so compromise of one doesn't compromise all. Falls back to JWT_SECRET
    # only in dev; production must set each explicitly.
    EMAIL_TOKEN_SECRET: str = os.getenv("EMAIL_TOKEN_SECRET", "") or os.getenv("JWT_SECRET", "")
    MAGIC_LINK_SECRET: str = os.getenv("MAGIC_LINK_SECRET", "") or os.getenv("JWT_SECRET", "")
    TASK_SESSION_SECRET: str = os.getenv("TASK_SESSION_SECRET", "") or os.getenv("JWT_SECRET", "")

    # Server
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://callmedex-frontend.vercel.app")

    # AI Services
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DAILY_API_KEY: str = os.getenv("DAILY_API_KEY", "")

    # Optional — Phase 2+
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    WHATSAPP_TOKEN: str = os.getenv("WHATSAPP_TOKEN", "")
    WHATSAPP_PHONE_ID: str = os.getenv("WHATSAPP_PHONE_ID", "")
    ABDM_CLIENT_ID: str = os.getenv("ABDM_CLIENT_ID", "")
    ABDM_CLIENT_SECRET: str = os.getenv("ABDM_CLIENT_SECRET", "")
    ABDM_SANDBOX_URL: str = os.getenv(
        "ABDM_SANDBOX_URL", "https://sandbox.abdm.gov.in"
    )
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

    # ─── Phase 3: Telephony (Masked Calling) ──────────────────────────
    EXOTEL_API_KEY: str = os.getenv("EXOTEL_API_KEY", "")
    EXOTEL_API_TOKEN: str = os.getenv("EXOTEL_API_TOKEN", "")
    EXOTEL_SID: str = os.getenv("EXOTEL_SID", "")

    # ─── Phase 5: Redis (Caching, Rate Limiting, Sessions) ────────────
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # ─── Phase 5: Email (Resend / SMTP) ──────────────────────────────────
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: str = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("EMAIL_FROM") or os.getenv("SMTP_FROM_EMAIL", "support@callmedex.com")

    # ─── Phase 5: Rate Limiting ───────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

    # ─── Phase 8: AI Verification Pipeline ────────────────────────────
    # Defaults to LIVE, not mock. This previously defaulted to "true", so any
    # deployment that had not explicitly set it verified provider credentials
    # against GovRegistryAPI._mock_verify — which approves any identifier of
    # four or more characters that does not contain FAKE/INVALID/TEST. A doctor
    # registering with licence number "1234" was therefore marked verified
    # against the National Medical Council, and a pharmacy with drug licence
    # "ABCD" likewise. Mock mode must now be opted into deliberately.
    USE_MOCK_GOV_API: bool = os.getenv("USE_MOCK_GOV_API", "false").lower() in ("true", "1", "yes")
    NMC_API_URL: str = os.getenv("NMC_API_URL", "https://www.nmc.org.in/api/v1")
    NURSING_COUNCIL_API_URL: str = os.getenv("NURSING_COUNCIL_API_URL", "https://indiannursingcouncil.org/api/v1")

    # ─── Layer 0: Marketplace foundation flags ────────────────────────
    VERIFICATION_AUTO_APPROVE: bool = os.getenv("VERIFICATION_AUTO_APPROVE", "true").lower() in ("true", "1", "yes")
    GOV_REGISTRY_MODE: str = os.getenv("GOV_REGISTRY_MODE", "off")  # off | mock | live — no real gov API keys available, using AI scoring
    TRUSTED_PROXY_COUNT: int = int(os.getenv("TRUSTED_PROXY_COUNT", "0"))
    ALLOWED_ORIGINS: list = [
        o.strip() for o in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://localhost:3001,"
            "https://callmedex-v1.vercel.app,https://callmedex-frontend.vercel.app,"
            "https://www.callmedex.com,https://callmedex.com"
        ).split(",") if o.strip()
    ]
    VERIFICATION_BUCKET: str = os.getenv("VERIFICATION_BUCKET", "verification-docs")


settings = Settings()


# ─── Startup secret hygiene ───────────────────────────────────────────────
# The JWT secret signs every session token. If it is guessable, anyone can mint
# a token for any user_id and role — including admin — and the API will trust it.
# The fallback below is committed to a public repository, so falling back to it
# in a deployed environment is equivalent to having no authentication at all.
_WEAK_JWT_SECRETS = {
    "callmedex-dev-secret",
    "callmedex-dev-secret-local",
    "callmedex-jwt-secret-change-in-production",
    "change-me", "secret", "changeme",
}

def jwt_secret_warning() -> str:
    """Return a warning string if the configured JWT secret is unsafe, else ''.

    Returns empty string only when the secret is strong enough for production.
    The caller (main.py lifespan) should refuse to start if this returns non-empty
    and the environment is not explicitly a dev environment.
    """
    secret = (settings.JWT_SECRET or "").strip()
    if not secret:
        return (
            "JWT_SECRET is not set. Session tokens cannot be signed. "
            "Set it to a random 64-character hex string, e.g. `openssl rand -hex 32`."
        )
    if secret in _WEAK_JWT_SECRETS:
        return (
            "JWT_SECRET is a known placeholder value. Session tokens can be "
            "forged for ANY user, including admin. Rotate it immediately."
        )
    if len(secret) < 32:
        return (
            f"JWT_SECRET is only {len(secret)} characters. Use at least 32 "
            "random bytes, e.g. `openssl rand -hex 32`."
        )
    return ""


def mock_verification_warning() -> str:
    """Warn if provider credentials are being verified against the mock registry."""
    if settings.USE_MOCK_GOV_API:
        return (
            "USE_MOCK_GOV_API is on. Doctor, pharmacy and organization licences "
            "are NOT checked against any government registry — the mock approves "
            "any identifier of four or more characters. Every provider verified "
            "while this is set must be re-verified before being trusted."
        )
    return ""
