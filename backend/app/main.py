"""
CallMedex Backend — FastAPI Application Entry Point
India's AI-native healthcare orchestration platform.
Next-Gen: Universal Provider, Legal Docs, Dispatch Engine, Comms, Analytics,
          Provider Management, Payments, Security Hardening.
Production-ready: GZip compression, request timeouts, graceful shutdown.
"""
import signal
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.config import settings
from app.routers import (
    auth, bookings, verification, dispatch, whatsapp, admin,
    pharmacy_orders, telemedicine, insurance, ai_reports,
    communications, admin_analytics, provider_management,
)
from app.routers import payments
from app.middleware.security import SecurityMiddleware
from app.middleware.rate_limiter import RateLimitMiddleware

# ─── Structured Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─── Graceful Shutdown ───────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    logger.info("🚀 CallMedex API starting up...")
    logger.info(f"   Supabase: {'✅ configured' if settings.SUPABASE_URL else '❌ not configured'}")
    logger.info(f"   Razorpay: {'✅ configured' if settings.RAZORPAY_KEY_ID else '❌ not configured'}")
    logger.info(f"   Gemini AI: {'✅ configured' if settings.GEMINI_API_KEY else '❌ not configured'}")
    logger.info(f"   Redis: {'✅ configured' if settings.REDIS_URL != 'redis://localhost:6379/0' else '⚠️ default (local)'}")
    yield
    logger.info("🛑 CallMedex API shutting down gracefully...")


app = FastAPI(
    title="CallMedex API",
    description="Next-Gen AI-native healthcare marketplace — Universal Provider, Masked Calling, Real-time Dispatch, Payments, Video Consultation",
    version="3.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)


# ─── Request Timeout Middleware ──────────────────────────────────────────
class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    """
    Enforce request timeouts to prevent hung connections.
    AI endpoints get longer timeouts (5 min), standard endpoints get 60s.
    """
    # Endpoints that need longer timeouts (AI processing)
    LONG_TIMEOUT_PATHS = {
        "/api/reports/analyze",
        "/api/telemed/finalize",
        "/api/verification/verify",
    }
    DEFAULT_TIMEOUT = 60      # 60 seconds for normal requests
    AI_TIMEOUT = 300           # 5 minutes for AI-heavy requests

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        timeout = self.AI_TIMEOUT if any(path.startswith(p) for p in self.LONG_TIMEOUT_PATHS) else self.DEFAULT_TIMEOUT

        try:
            return await asyncio.wait_for(
                call_next(request),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            logger.error(f"Request timeout ({timeout}s): {request.method} {path}")
            return JSONResponse(
                status_code=504,
                content={
                    "detail": "Request timed out. Please try again.",
                    "timeout_seconds": timeout,
                },
            )


# ─── Middleware Stack (order matters — outermost first) ──────────────────
# 1. Security headers and request tracking
app.add_middleware(SecurityMiddleware)
# 2. Rate limiting (Redis-backed)
app.add_middleware(RateLimitMiddleware)
# 3. Request timeouts
app.add_middleware(RequestTimeoutMiddleware)
# 4. GZip compression for responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# ─── CORS ─────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
]
# Add production domains
if settings.FRONTEND_URL not in ("http://localhost:3000", ""):
    ALLOWED_ORIGINS.append(settings.FRONTEND_URL)

# Add Vercel deployment
ALLOWED_ORIGINS.append("https://callmedex-v1.vercel.app")

# Allow Jitsi Meet for video consultation
ALLOWED_ORIGINS.append("https://meet.jit.si")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-Request-ID",
    ],
    expose_headers=[
        "X-Request-ID",
        "X-RateLimit-Remaining",
        "X-RateLimit-Limit",
        "X-RateLimit-Reset",
        "Retry-After",
    ],
)

# ─── Routers ──────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(bookings.router)
app.include_router(verification.router)
app.include_router(dispatch.router)
app.include_router(whatsapp.router)
app.include_router(admin.router)
app.include_router(pharmacy_orders.router)
app.include_router(telemedicine.router)
app.include_router(insurance.router)
app.include_router(ai_reports.router)
app.include_router(communications.router)
app.include_router(admin_analytics.router)
app.include_router(provider_management.router)
app.include_router(payments.router)

# ─── Health Check ─────────────────────────────────────────────────────────
@app.get("/api/health")
@app.head("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "CallMedex API",
        "version": "3.1.0",
        "supabase_configured": bool(settings.SUPABASE_URL),
        "razorpay_configured": bool(settings.RAZORPAY_KEY_ID),
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "features": [
            "universal_provider",
            "legal_documents",
            "universal_dispatch",
            "masked_calling",
            "admin_analytics",
            "provider_management",
            "payments",
            "security_hardening",
            "rate_limiting",
            "video_consultation",
            "ai_eprescription",
            "gzip_compression",
            "request_timeouts",
        ],
    }


@app.get("/")
@app.head("/")
async def root():
    return {
        "message": "CallMedex API v3.1 — Enterprise Healthcare Marketplace. Visit /api/docs for documentation.",
        "version": "3.1.0",
    }
