"""
Supabase client initialization.
Uses service-role key for backend operations (bypasses RLS).
"""
from supabase import create_client, Client
from app.config import settings


def get_supabase_client() -> Client:
    """Get a Supabase client instance with service-role key."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        # Return None-safe fallback for local dev without Supabase
        return None
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def get_supabase_anon_client() -> Client:
    """Get a Supabase client with anon key (respects RLS)."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return None
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


# Singleton client for import
supabase: Client = get_supabase_client()
