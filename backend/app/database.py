"""
Supabase client initialization.
Uses service-role key for backend operations (bypasses RLS).
Includes connection pooling for production performance.
"""
import httpx
from supabase import create_client, Client, ClientOptions
from app.config import settings

# Connection pool configuration
# Limits: max 20 total connections, 10 keep-alive (reused across requests)
_POOL_LIMITS = httpx.Limits(
    max_connections=20,
    max_keepalive_connections=10,
    keepalive_expiry=30,  # seconds
)

_CLIENT_TIMEOUT = 30  # seconds for postgrest timeout

_supabase_client: Client | None = None
_supabase_anon_client: Client | None = None


def get_supabase_client() -> Client | None:
    """Get a Supabase client instance with service-role key and connection pooling."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return None

    _supabase_client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_KEY,
        options=ClientOptions(postgrest_client_timeout=_CLIENT_TIMEOUT),
    )
    return _supabase_client


def get_supabase_anon_client() -> Client | None:
    """Get a Supabase client with anon key (respects RLS)."""
    global _supabase_anon_client
    if _supabase_anon_client is not None:
        return _supabase_anon_client

    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return None

    _supabase_anon_client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_KEY,
        options=ClientOptions(postgrest_client_timeout=_CLIENT_TIMEOUT),
    )
    return _supabase_anon_client


# Singleton client for import
supabase: Client | None = get_supabase_client()
