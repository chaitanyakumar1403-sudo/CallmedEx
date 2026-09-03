"""
JWT Authentication middleware.
Extracts and verifies JWT from Authorization header.
Supports token revocation via token_version.
"""
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.security import decode_access_token, validate_token_version

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Decode JWT token, validate token_version, and return user payload."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Validate token version (revocation check)
    user_id = payload.get("sub")
    token_ver = payload.get("ver", 1)
    if user_id and token_ver:
        if not await validate_token_version(user_id, token_ver):
            raise HTTPException(
                status_code=401,
                detail="Session has been revoked. Please log in again.",
            )

    return payload


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
) -> dict | None:
    """Extract and decode JWT token if provided; returns None if unauthenticated."""
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    return payload


async def require_role(required_role: str):
    """Factory for role-based access control."""

    async def role_checker(user: dict = Depends(get_current_user)):
        if user.get("role") != required_role and user.get("role") != "admin":
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {required_role}",
            )
        return user

    return role_checker
