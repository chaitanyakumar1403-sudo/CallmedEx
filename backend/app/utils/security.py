"""
Security utilities — password hashing + JWT token management.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
    token_version: int = 1,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        data: Core claims (sub, email, role, name, etc.)
        expires_delta: Optional custom expiry. Defaults to ACCESS_TOKEN_EXPIRE_MINUTES.
        token_version: From the user's token_version column. Incremented on
                       password change, logout, or admin-forced invalidation.
                       Older tokens with a lower version are rejected.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "ver": token_version,
    })
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT token. Returns the payload dict or None.

    NOTE: This only verifies the signature and expiry — it does NOT
    validate the token_version against the database. Use
    validate_token_version() for that check.
    """
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") == "refresh":
            # Refresh tokens cannot be used as access tokens
            return None
        return payload
    except JWTError:
        return None


def create_refresh_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
    token_version: int = 1,
) -> str:
    """
    Create a signed long-lived refresh token.

    Args:
        data: Core claims (sub, email, role)
        expires_delta: Optional custom expiry. Defaults to REFRESH_TOKEN_EXPIRE_DAYS.
        token_version: Version for revocation checking.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "ver": token_version,
        "type": "refresh",
    })
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_refresh_token(token: str) -> Optional[dict]:
    """Decode and verify a refresh token. Ensures token type is 'refresh'."""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None



async def validate_token_version(user_id: str, token_version: int) -> bool:
    """
    Check that the token's version matches the user's current version.
    If the user's version has been incremented (password change, logout, admin
    action), tokens with the old version are rejected.

    Returns True if the token is still valid, False if it has been revoked.
    """
    if token_version < 1:
        return False

    try:
        from app.database import supabase
        if supabase:
            try:
                result = await __import__("asyncio").to_thread(
                    lambda: supabase.table("users")
                        .select("token_version")
                        .eq("id", user_id)
                        .limit(1)
                        .execute()
                )
                if result.data and len(result.data) > 0:
                    current_version = result.data[0].get("token_version", 1)
                    return token_version >= current_version
            except Exception:
                pass

        # Check local in-memory users
        try:
            from app.routers.auth import _local_users
            for u in _local_users.values():
                if u.get("id") == user_id:
                    return token_version >= u.get("token_version", 1)
        except Exception:
            pass

        return False
    except Exception:
        return False

