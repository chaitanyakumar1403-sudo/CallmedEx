"""
Redis Caching Service — CallMedex
Provides a simple cache-aside pattern for frequently accessed data.
Uses Redis when available, falls back to in-memory LRU cache.
"""
import asyncio
import json
import logging
import time
from collections import OrderedDict
from typing import Any, Optional, Callable, Awaitable

logger = logging.getLogger(__name__)

# In-memory LRU cache fallback (max 1000 entries)
_MAX_MEMORY_ENTRIES = 1000
_memory_cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()

# Redis client (lazy-loaded, shared with rate limiter)
_redis = None


async def _get_redis():
    """Lazy-load Redis client (reuses rate limiter's connection if available)."""
    global _redis
    if _redis is not None:
        return _redis

    try:
        import redis.asyncio as aioredis
        from app.config import settings

        _redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=False,  # We'll handle JSON encode/decode ourselves
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        await _redis.ping()
        logger.info("✅ Cache service: Redis connected")
        return _redis
    except Exception as e:
        logger.warning(f"⚠️ Cache service: Redis unavailable ({e}). Using in-memory cache.")
        _redis = False  # Mark as unavailable
        return None


def _cache_key(prefix: str, *args: str) -> str:
    """Build a namespaced cache key."""
    return f"cache:{prefix}:" + ":".join(args)


async def get(
    key: str,
    default: Any = None,
) -> Optional[Any]:
    """Get a value from cache. Returns default if not found."""
    # Try Redis first
    redis = await _get_redis()
    if redis:
        try:
            raw = await redis.get(key)
            if raw:
                return json.loads(raw)
        except Exception:
            pass

    # Fallback to in-memory
    if key in _memory_cache:
        value, _ = _memory_cache[key]
        return value
    return default


async def set(
    key: str,
    value: Any,
    ttl_seconds: int = 60,
) -> None:
    """Set a value in cache with TTL."""
    # Store in Redis
    redis = await _get_redis()
    if redis:
        try:
            await redis.setex(key, ttl_seconds, json.dumps(value, default=str))
        except Exception:
            pass

    # Always store in memory as fallback
    _memory_cache[key] = (value, time.time() + ttl_seconds)
    # Evict oldest if over capacity
    while len(_memory_cache) > _MAX_MEMORY_ENTRIES:
        _memory_cache.popitem(last=False)


async def get_or_set(
    key: str,
    factory: Callable[[], Awaitable[Any]],
    ttl_seconds: int = 60,
) -> Any:
    """
    Get from cache, or compute with factory function and cache the result.
    This is the primary cache-aside pattern.
    """
    cached = await get(key)
    if cached is not None:
        return cached

    value = await factory()
    if value is not None:
        await set(key, value, ttl_seconds)
    return value


async def invalidate(prefix: str) -> int:
    """
    Invalidate all cache entries matching a prefix.
    Returns count of invalidated entries.
    """
    count = 0

    # Redis pattern delete
    redis = await _get_redis()
    if redis:
        try:
            pattern = f"cache:{prefix}:*"
            cursor = 0
            while True:
                cursor, keys = await redis.scan(cursor, match=pattern, count=100)
                if keys:
                    await redis.delete(*keys)
                    count += len(keys)
                if cursor == 0:
                    break
        except Exception:
            pass

    # In-memory cleanup
    mem_prefix = f"cache:{prefix}:"
    keys_to_remove = [k for k in _memory_cache if k.startswith(mem_prefix)]
    for k in keys_to_remove:
        del _memory_cache[k]
    count += len(keys_to_remove)

    return count


# ─── Convenience helpers for common cache patterns ───────────────────────────

# Cache TTLs by data type
CACHE_TTL = {
    "doctor_list": 300,        # 5 minutes
    "test_catalog": 1800,      # 30 minutes
    "provider_location": 30,   # 30 seconds
    "org_services": 300,       # 5 minutes
    "patient_profile": 120,    # 2 minutes
    "analytics": 60,           # 1 minute
    "health_packages": 600,    # 10 minutes
}


async def cached_doctor_list(factory: Callable[[], Awaitable[Any]]) -> Any:
    return await get_or_set(_cache_key("doctors", "list"), factory, CACHE_TTL["doctor_list"])


async def cached_test_catalog(factory: Callable[[], Awaitable[Any]]) -> Any:
    return await get_or_set(_cache_key("catalog", "tests"), factory, CACHE_TTL["test_catalog"])


async def cached_org_services(org_id: str, factory: Callable[[], Awaitable[Any]]) -> Any:
    return await get_or_set(
        _cache_key("org", org_id, "services"), factory, CACHE_TTL["org_services"]
    )


async def invalidate_doctor_cache() -> int:
    return await invalidate("doctors")


async def invalidate_catalog_cache() -> int:
    return await invalidate("catalog")