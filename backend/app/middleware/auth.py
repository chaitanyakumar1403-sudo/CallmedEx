"""
JWT Authentication middleware.
Extracts and verifies JWT from Authorization header.
"""
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.security import decode_access_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Decode JWT token and return user payload."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
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
