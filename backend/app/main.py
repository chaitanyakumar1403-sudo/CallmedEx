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
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.config import settings, jwt_secret_warning, mock_verification_warning
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


def _normalise_origin(origin: str) -> str:
    """Strip whitespace and any trailing slash.

    A browser sends `Origin: https://site.app` with no trailing slash, so a
    configured value of `https://site.app/` would never match and every preflight
    would fail with an opaque 400.
    """
    return (origin or "").strip().rstrip("/")


def build_allowed_origins() -> list:
    """
    The effective CORS allowlist.

    FRONTEND_URL is always included. Previously the allowlist came only from
    ALLOWED_ORIGINS, so the app could know its own frontend URL and still reject
    it — which is exactly how every dashboard call started failing preflight
    with a 400 while /api/health kept returning 200.
    """
    origins = [_normalise_origin(o) for o in settings.ALLOWED_ORIGINS]
    frontend = _normalise_origin(settings.FRONTEND_URL)
    if frontend and frontend not in origins:
        origins.append(frontend)
    return [o for o in origins if o]


def _vercel_project(origin: str) -> str:
    """Project prefix of a *.vercel.app origin, or '' if it is not one."""
    host = _normalise_origin(origin).split("://")[-1]
    if not host.endswith(".vercel.app"):
        return ""
    return host.split(".")[0].split("-git-")[0]


def vercel_preview_regex(*origins: str) -> str:
    """
    Allow Vercel preview deployments of the known projects.

    Preview URLs are generated per branch and commit, so they can never appear in
    a static allowlist. Every configured *.vercel.app origin contributes its
    project prefix, because the frontend may be deployed under more than one
    project name (callmedex-v1 and callmedex-frontend both exist here).

    Deliberately scoped to those prefixes rather than all of *.vercel.app: with
    allow_credentials=True, a blanket wildcard would let anyone's Vercel
    deployment call this API with a logged-in user's session.
    """
    projects = sorted({p for o in origins if (p := _vercel_project(o))})
    if not projects:
        return ""
    alternation = "|".join(re.escape(p) for p in projects)
    return rf"^https://({alternation})(-[a-z0-9\-]+)?\.vercel\.app$"


def is_origin_allowed(origin: str, allowlist: list) -> bool:
    """Exact match against the allowlist, ignoring trailing-slash differences."""
    if not origin:
        return False
    normalised = _normalise_origin(origin)
    return normalised in [_normalise_origin(a) for a in allowlist]


# ─── Graceful Shutdown ───────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    logger.info("🚀 CallMedex API starting up...")
    logger.info(f"   Supabase: {'✅ configured' if settings.SUPABASE_URL else '❌ not configured'}")
    logger.info(f"   Razorpay: {'✅ configured' if settings.RAZORPAY_KEY_ID else '❌ not configured'}")
    logger.info(f"   Gemini AI: {'✅ configured' if settings.GEMINI_API_KEY else '❌ not configured'}")
    logger.info(f"   Redis: {'✅ configured' if settings.REDIS_URL != 'redis://localhost:6379/0' else '⚠️ default (local)'}")
    if (warning := jwt_secret_warning()):
        logger.critical("=" * 78)
        logger.critical(f"🔴 SECURITY: {warning}")
        logger.critical("=" * 78)
    if (warning := mock_verification_warning()):
        logger.critical("=" * 78)
        logger.critical(f"🔴 VERIFICATION: {warning}")
        logger.critical("=" * 78)
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
ALLOWED_ORIGINS = build_allowed_origins()
_PREVIEW_REGEX = vercel_preview_regex(settings.FRONTEND_URL, *ALLOWED_ORIGINS)

# Logged at import so a CORS rejection is diagnosable straight from the deploy
# logs, instead of showing up only as an unexplained 400 on every preflight.
logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")
if _PREVIEW_REGEX:
    logger.info(f"CORS preview pattern: {_PREVIEW_REGEX}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=_PREVIEW_REGEX or None,
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

class CORSDiagnosticMiddleware(BaseHTTPMiddleware):
    """
    Log the Origin of every preflight, and flag rejected ones.

    CORSMiddleware answers preflights itself and returns a bare
    "Disallowed CORS origin" with no indication of WHICH origin, which makes a
    misconfigured allowlist almost undiagnosable from logs alone. Registered
    after CORSMiddleware so it sits outside it and sees the response.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.method == "OPTIONS":
            origin = request.headers.get("origin", "")
            if response.status_code == 400:
                logger.warning(
                    f"CORS REJECTED origin={origin!r} path={request.url.path} — "
                    f"add it to ALLOWED_ORIGINS or FRONTEND_URL. "
                    f"Currently allowed: {ALLOWED_ORIGINS}"
                )
        return response


app.add_middleware(CORSDiagnosticMiddleware)


# ─── Global Exception Handlers ──────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(f"[{request_id}] Unhandled exception on {request.url.path}")
    return JSONResponse(status_code=500, content={
        "success": False, "message": "An unexpected error occurred.", "request_id": request_id})

# ─── Routers ──────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(bookings.router)
app.include_router(verification.router)
app.include_router(dispatch.router)
app.include_router(whatsapp.router)
app.include_router(admin.router)
app.include_router(pharmacy_orders.router)
app.include_router(telemedicine.router)
from app.routers import ai_features
app.include_router(ai_features.router)
app.include_router(insurance.router)
app.include_router(ai_reports.router)
app.include_router(communications.router)
app.include_router(admin_analytics.router)
app.include_router(provider_management.router)
from app.routers import admin_verification
app.include_router(admin_verification.router)
app.include_router(payments.router)
from app.routers import samples
app.include_router(samples.router)
from app.routers import lab_team
app.include_router(lab_team.router)
from app.routers import marketplace
app.include_router(marketplace.router)
from app.routers import processing_center_admin
app.include_router(processing_center_admin.router)
app.include_router(processing_center_admin.me_router)
from app.routers import home_services
app.include_router(home_services.router)
from app.routers import family_members
app.include_router(family_members.router)
from app.routers import roster
app.include_router(roster.router)

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
