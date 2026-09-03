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

    # Environment Architecture (development | staging | production)
    APP_ENV: str = os.getenv("APP_ENV", "development").lower()
    OTP_PROVIDER: str = os.getenv("OTP_PROVIDER", "mock" if os.getenv("APP_ENV", "development").lower() == "development" else "msg91").lower()
    ENABLE_DEV_MOCK_PAYMENT: bool = os.getenv("ENABLE_DEV_MOCK_PAYMENT", "true" if os.getenv("APP_ENV", "development").lower() == "development" else "false").lower() in ("true", "1", "yes")

    # Server
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://callmedex-frontend.vercel.app")

    # AI Services
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DAILY_API_KEY: str = os.getenv("DAILY_API_KEY", "")

    # Optional — Phase 2+
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")

    # ─── OpenRouter AI (multi-model gateway) ──────────────────────────
    # Consolidates vision OCR, report analysis, and MediAssist fallback
    # behind one API key. Model IDs are configurable without deploy.
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    OPENROUTER_VISION_MODEL: str = os.getenv("OPENROUTER_VISION_MODEL", "qwen/qwen3.7-flash")
    OPENROUTER_ANALYSIS_MODEL: str = os.getenv("OPENROUTER_ANALYSIS_MODEL", "deepseek/deepseek-v4-flash-0731")
    OPENROUTER_FALLBACK_MODEL: str = os.getenv("OPENROUTER_FALLBACK_MODEL", "deepseek/deepseek-v4-pro")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
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
            "http://localhost:3000,http://localhost:3001,http://localhost:8081,http://localhost:19006,"
            "https://callmedex-v1.vercel.app,https://callmedex-frontend.vercel.app,"
            "https://www.callmedex.com,https://callmedex.com"
        ).split(",") if o.strip()
    ]
    VERIFICATION_BUCKET: str = os.getenv("VERIFICATION_BUCKET", "verification-docs")
    REPORTS_BUCKET: str = os.getenv("REPORTS_BUCKET", "lab-reports")

    # ─── MediAssist AI Integration ─────────────────────────────────────
    # MediAssist AI owns OCR, AI report interpretation, and all WhatsApp
    # messaging (report delivery + operational notifications). CallMedex
    # reaches it only through this signed REST contract — see
    # docs/integrations/mediassist-ai/.
    MEDIASSIST_BASE_URL: str = os.getenv("MEDIASSIST_BASE_URL", "http://localhost:8000")
    MEDIASSIST_BEARER_TOKEN: str = os.getenv("MEDIASSIST_BEARER_TOKEN", "")
    MEDIASSIST_HMAC_SECRET: str = os.getenv("MEDIASSIST_HMAC_SECRET", "")
    MEDIASSIST_CONNECT_TIMEOUT_SECONDS: float = float(
        os.getenv("MEDIASSIST_CONNECT_TIMEOUT_SECONDS", "10")
    )
    MEDIASSIST_TOTAL_TIMEOUT_SECONDS: float = float(
        os.getenv("MEDIASSIST_TOTAL_TIMEOUT_SECONDS", "20")
    )
    MEDIASSIST_MAX_RETRIES: int = int(os.getenv("MEDIASSIST_MAX_RETRIES", "5"))
    MEDIASSIST_CIRCUIT_FAILURE_THRESHOLD: int = int(
        os.getenv("MEDIASSIST_CIRCUIT_FAILURE_THRESHOLD", "5")
    )
    MEDIASSIST_CIRCUIT_RESET_SECONDS: float = float(
        os.getenv("MEDIASSIST_CIRCUIT_RESET_SECONDS", "30")
    )
    # Public base URL of THIS CallMedex backend, sent to MediAssist as the
    # prefix it appends /callbacks/... to when calling back.
    CALLMEDEX_PUBLIC_BASE_URL: str = os.getenv(
        "CALLMEDEX_PUBLIC_BASE_URL", "http://localhost:8000"
    )
    # Token MediAssist presents calling INTO CallMedex; inbound signatures reuse MEDIASSIST_HMAC_SECRET (one shared secret, both directions — no rotation system needed for this plan's scope).
    MEDIASSIST_INBOUND_BEARER_TOKEN: str = os.getenv("MEDIASSIST_INBOUND_BEARER_TOKEN", "")


    # ─── Mobile Platform & Notifications ──────────────────────────────
    MOBILE_BUNDLE_ID: str = os.getenv("MOBILE_BUNDLE_ID", "com.callmedex.app")
    BIOMETRIC_CHALLENGE_SECRET: str = os.getenv("BIOMETRIC_CHALLENGE_SECRET", "") or os.getenv("JWT_SECRET", "")
    # Push delivery (app/services/push.py) uses FCM HTTP v1: paste the whole
    # service-account JSON into FCM_SERVICE_ACCOUNT_JSON. FCM_PROJECT_ID is
    # optional — it defaults to the project_id inside that JSON.
    FCM_SERVICE_ACCOUNT_JSON: str = os.getenv("FCM_SERVICE_ACCOUNT_JSON", "")
    FCM_PROJECT_ID: str = os.getenv("FCM_PROJECT_ID", "")

    # APNs token-based auth for iOS. The mobile client's
    # getDevicePushTokenAsync() returns a raw APNs token on iOS, which FCM v1
    # cannot address, so iOS is delivered directly. APNS_PRIVATE_KEY is the
    # contents of the .p8 file (BEGIN PRIVATE KEY ... END PRIVATE KEY).
    APNS_KEY_ID: str = os.getenv("APNS_KEY_ID", "")
    APNS_TEAM_ID: str = os.getenv("APNS_TEAM_ID", "")
    APNS_PRIVATE_KEY: str = os.getenv("APNS_PRIVATE_KEY", "")
    # "production" once the app ships; sandbox is what a dev build registers
    # against, and a token from one environment is invalid in the other.
    APNS_USE_SANDBOX: bool = os.getenv("APNS_USE_SANDBOX", "false").lower() in ("true", "1", "yes")

    # DEPRECATED — Google shut down the legacy FCM server-key endpoint in
    # June 2024. Nothing reads this; use FCM_SERVICE_ACCOUNT_JSON.
    FCM_SERVER_KEY: str = os.getenv("FCM_SERVER_KEY", "")

    # ─── MSG91 SMS OTP Gateway ─────────────────────────────────────────
    MSG91_AUTH_KEY: str = os.getenv("MSG91_AUTH_KEY", "")
    MSG91_TEMPLATE_ID: str = os.getenv("MSG91_TEMPLATE_ID", "")
    MSG91_SENDER_ID: str = os.getenv("MSG91_SENDER_ID", "CLMDEX")
    MSG91_OTP_LENGTH: int = int(os.getenv("MSG91_OTP_LENGTH", "6"))
    MSG91_OTP_EXPIRY_MINUTES: int = int(os.getenv("MSG91_OTP_EXPIRY_MINUTES", "5"))
    # DLT-registered flow/template used for notification SMS (not OTP). The
    # message text is sent as that template's VAR1, so register a template of
    # the form "CallMedex: ##VAR1##" before setting this.
    MSG91_FLOW_ID: str = os.getenv("MSG91_FLOW_ID", "")

    # ─── Patient Dashboard Upgrade Feature Flags ─────────────────────────
    ENABLE_PREVENTIVE_BIOMARKERS: bool = os.getenv("ENABLE_PREVENTIVE_BIOMARKERS", "true").lower() in ("true", "1", "yes")
    # NHCX insurance is scaffolding: app/services/nhcx.py returns a fixed
    # "Star Health, Rs 5,00,000, Active" for any ABHA and claim submission
    # persists a mock insurer id. Off by default so it cannot answer
    # confidently in production; flip on only against a real NHCX sandbox.
    ENABLE_NHCX_INSURANCE: bool = os.getenv("ENABLE_NHCX_INSURANCE", "false").lower() in ("true", "1", "yes")
    ENABLE_DOCTOR_BRIEFING: bool = os.getenv("ENABLE_DOCTOR_BRIEFING", "true").lower() in ("true", "1", "yes")
    ENABLE_FAMILY_SWIPER: bool = os.getenv("ENABLE_FAMILY_SWIPER", "true").lower() in ("true", "1", "yes")
    ENABLE_EMERGENCY_SOS: bool = os.getenv("ENABLE_EMERGENCY_SOS", "true").lower() in ("true", "1", "yes")
    ENABLE_SMART_MEDICINE_CABINET: bool = os.getenv("ENABLE_SMART_MEDICINE_CABINET", "true").lower() in ("true", "1", "yes")
    ENABLE_PHLEBO_RADAR: bool = os.getenv("ENABLE_PHLEBO_RADAR", "true").lower() in ("true", "1", "yes")


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
