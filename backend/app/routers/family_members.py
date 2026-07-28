"""
Family members.

Every booking subject — including the account holder — is a family_members row.
That uniformity is what makes "separate barcode, separate sample, separate
report" per person fall out of the schema instead of needing a special case.
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import supabase
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/family-members", tags=["Family Members"])


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


class MemberIn(BaseModel):
    full_name: str
    relationship: str = ""
    gender: str = ""
    date_of_birth: Optional[str] = None
    mobile: str = ""


def ensure_self_member(account_user_id: str, full_name: str) -> dict:
    """Idempotently create the account holder's own subject row."""
    existing = _rows(
        supabase.table("family_members").select("*")
        .eq("account_user_id", account_user_id).eq("is_self", True)
        .limit(1).execute()
    )
    if existing:
        return existing[0]

    created = _rows(
        supabase.table("family_members").insert({
            "account_user_id": account_user_id,
            "full_name": full_name,
            "relationship": "self",
            "is_self": True,
        }).execute()
    )
    return created[0] if created else {}


@router.get("")
async def list_members(user: dict = Depends(get_current_user)):
    account_id = user.get("sub")
    ensure_self_member(account_id, user.get("full_name") or "")
    return {"members": _rows(
        supabase.table("family_members").select("*")
        .eq("account_user_id", account_id).execute()
    )}


@router.post("")
async def add_member(payload: MemberIn, user: dict = Depends(get_current_user)):
    body = payload.model_dump()
    body["account_user_id"] = user.get("sub")
    body["is_self"] = False
    created = _rows(supabase.table("family_members").insert(body).execute())
    return {"member": created[0] if created else None}


@router.patch("/{member_id}")
async def update_member(member_id: str, payload: dict,
                        user: dict = Depends(get_current_user)):
    payload.pop("is_self", None)          # the self row cannot be reassigned
    payload.pop("account_user_id", None)
    updated = _rows(
        supabase.table("family_members").update(payload)
        .eq("id", member_id).eq("account_user_id", user.get("sub")).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Family member not found.")
    return {"member": updated[0]}


@router.delete("/{member_id}")
async def delete_member(member_id: str, user: dict = Depends(get_current_user)):
    rows = _rows(
        supabase.table("family_members").select("is_self")
        .eq("id", member_id).eq("account_user_id", user.get("sub")).limit(1).execute()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Family member not found.")
    if rows[0].get("is_self"):
        raise HTTPException(status_code=400, detail="You cannot remove yourself.")
    supabase.table("family_members").delete().eq("id", member_id) \
        .eq("account_user_id", user.get("sub")).execute()
    return {"ok": True}
