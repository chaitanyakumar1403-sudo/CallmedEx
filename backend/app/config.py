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
    JWT_SECRET: str = os.getenv("JWT_SECRET", "callmedex-dev-secret")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080")
    )

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
    USE_MOCK_GOV_API: bool = os.getenv("USE_MOCK_GOV_API", "true").lower() in ("true", "1", "yes")
    NMC_API_URL: str = os.getenv("NMC_API_URL", "https://www.nmc.org.in/api/v1")
    NURSING_COUNCIL_API_URL: str = os.getenv("NURSING_COUNCIL_API_URL", "https://indiannursingcouncil.org/api/v1")


settings = Settings()
