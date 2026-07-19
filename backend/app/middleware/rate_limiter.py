"""
Rate Limiter — Phase 7A (Production-Ready)
Sliding window rate limiter with Redis backend and in-memory fallback.
Protects against brute-force, scraping, and API abuse.
"""
import time
import logging
import asyncio
from collections import defaultdict
from typing import Optional, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# ─── Per-endpoint rate limits ─────────────────────────────────────────────
# Format: { "METHOD /path_prefix": (max_requests, window_seconds) }
ENDPOINT_LIMITS = {
    "POST /api/auth/login": (5, 60),            # 5 login attempts per minute
    "POST /api/auth/register": (3, 60),          # 3 registrations per minute
    "POST /api/reports/analyze": (10, 60),        # 10 AI report analyses per minute
    "POST /api/payments/create-order": (10, 60),  # 10 payment orders per minute
    "POST /api/verification": (5, 60),            # 5 verification attempts per minute
    "POST /api/telemed/start": (5, 60),           # 5 consultation starts per minute
    "POST /api/telemed/finalize": (5, 60),        # 5 finalization calls per minute
    "POST /api/dispatch/request": (10, 60),       # 10 dispatch requests per minute
    "POST /api/comm/chat": (30, 60),              # 30 chat messages per minute
}

# Default: 120 requests per minute per IP
DEFAULT_RATE_LIMIT = (120, 60)

# Skip rate limiting for these paths
SKIP_PATHS = {"/api/health", "/api/docs", "/api/redoc", "/openapi.json", "/"}
SKIP_IPS = {"127.0.0.1", "::1", "localhost"}

# ─── Redis client (lazy-loaded) ──────────────────────────────────────────
_redis_client = None
_redis_available = None  # None = not checked, True/False = checked


async def _get_redis():
    """Lazy-load Redis client. Returns None if Redis is unavailable."""
    global _redis_client, _redis_available

    if _redis_available is False:
        return None

    if _redis_client is not None:
        return _redis_client

    try:
        import redis.asyncio as aioredis
        from app.config import settings

        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=True,
        )
        # Test connection
        await _redis_client.ping()
        _redis_available = True
        logger.info("✅ Rate limiter: Redis connected")
        return _redis_client
    except Exception as e:
        _redis_available = False
        logger.warning(f"⚠️ Rate limiter: Redis unavailable ({e}). Falling back to in-memory.")
        return None


# ─── In-memory fallback store ────────────────────────────────────────────
_request_log: dict = defaultdict(list)
_MEMORY_CLEANUP_INTERVAL = 300  # Cleanup every 5 minutes
_last_cleanup = time.time()


def _memory_cleanup():
    """Periodic cleanup of expired entries to prevent memory leaks."""
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < _MEMORY_CLEANUP_INTERVAL:
        return

    _last_cleanup = now
    keys_to_remove = []
    for key, timestamps in _request_log.items():
        # Remove entries older than 120 seconds (max window)
        _request_log[key] = [t for t in timestamps if now - t < 120]
        if not _request_log[key]:
            keys_to_remove.append(key)

    for key in keys_to_remove:
        del _request_log[key]

    if keys_to_remove:
        logger.debug(f"Rate limiter cleanup: removed {len(keys_to_remove)} expired keys")


def _get_client_ip(request: Request) -> str:
    """Extract client IP, handling proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


def _get_rate_limit(method: str, path: str) -> Tuple[int, int]:
    """Get the rate limit for a specific endpoint."""
    key = f"{method} {path}"
    for pattern, limit in ENDPOINT_LIMITS.items():
        if key.startswith(pattern):
            return limit
    return DEFAULT_RATE_LIMIT


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Production-ready sliding window rate limiter.
    Uses Redis when available, falls back to in-memory.
    Returns HTTP 429 when rate limit is exceeded.
    """

    async def dispatch(self, request: Request, call_next):
        client_ip = _get_client_ip(request)
        method = request.method
        path = request.url.path

        # Skip rate limiting for health checks, docs, and local testing
        if path in SKIP_PATHS or client_ip in SKIP_IPS:
            return await call_next(request)

        max_requests, window_seconds = _get_rate_limit(method, path)
        rate_key = f"rl:{client_ip}:{method}:{path}"

        # Try Redis first, fallback to in-memory
        redis = await _get_redis()
        if redis:
            is_limited, current_count, retry_after = await self._check_redis(
                redis, rate_key, max_requests, window_seconds
            )
        else:
            is_limited, current_count, retry_after = self._check_memory(
                rate_key, max_requests, window_seconds
            )

        if is_limited:
            logger.warning(
                f"Rate limit exceeded: {client_ip} → {method} {path} "
                f"({current_count}/{max_requests} in {window_seconds}s)"
            )

            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please slow down.",
                    "retry_after_seconds": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + retry_after),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        remaining = max(0, max_requests - current_count)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)

        return response

    async def _check_redis(
        self, redis, key: str, max_requests: int, window: int
    ) -> Tuple[bool, int, int]:
        """Check rate limit using Redis sorted set (sliding window)."""
        try:
            now = time.time()
            pipeline = redis.pipeline()

            # Remove old entries
            pipeline.zremrangebyscore(key, 0, now - window)
            # Count current entries
            pipeline.zcard(key)
            # Add new entry
            pipeline.zadd(key, {str(now): now})
            # Set expiry on the key
            pipeline.expire(key, window + 1)

            results = await pipeline.execute()
            current_count = results[1]  # zcard result

            if current_count >= max_requests:
                # Get the oldest entry to calculate retry_after
                oldest = await redis.zrange(key, 0, 0, withscores=True)
                if oldest:
                    retry_after = int(window - (now - oldest[0][1]))
                    retry_after = max(1, retry_after)
                else:
                    retry_after = window
                return True, current_count, retry_after

            return False, current_count + 1, 0

        except Exception as e:
            logger.warning(f"Redis rate limit error: {e}. Falling back to in-memory.")
            return self._check_memory(key, max_requests, window)

    def _check_memory(
        self, key: str, max_requests: int, window: int
    ) -> Tuple[bool, int, int]:
        """Check rate limit using in-memory sliding window (fallback)."""
        _memory_cleanup()

        now = time.time()
        cutoff = now - window

        # Clean old entries for this key
        _request_log[key] = [t for t in _request_log[key] if t > cutoff]

        current_count = len(_request_log[key])

        if current_count >= max_requests:
            oldest = min(_request_log[key]) if _request_log[key] else now
            retry_after = int(window - (now - oldest))
            retry_after = max(1, retry_after)
            return True, current_count, retry_after

        # Record this request
        _request_log[key].append(now)
        return False, current_count + 1, 0
