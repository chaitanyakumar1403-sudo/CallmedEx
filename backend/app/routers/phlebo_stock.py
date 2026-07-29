"""
Phlebotomist Kit & Stock Tracking — DoctorC-style "Current Equipment" model.

Two tables drive this:
  - kit_items:  catalog of tubes, containers, and consumables (seeded by migration)
  - phlebo_stock: per-phlebotomist quantities that auto-decrement on collection

Auto-decrement is best-effort: it clamps at 0 and never blocks a collection
(even if the phlebo's inventory says 0, the tube can still be collected).
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/phlebo/stock", tags=["Phlebotomist Stock"])


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _first(result) -> dict:
    rows = _rows(result)
    return rows[0] if rows else {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_phlebo(user: dict) -> dict:
    if user.get("role") not in ("phlebotomist", "admin"):
        raise HTTPException(403, "Phlebotomists only.")
    return user


# ─── Request models ─────────────────────────────────────────────────────────

class UpsertStockRequest(BaseModel):
    item_code: str
    quantity: int = Field(ge=0)


# ─── GET — list all active kit items with phlebo's stock and used_today ────

@router.get("")
async def get_stock(
    user: dict = Depends(get_current_user),
):
    """All active kit items, LEFT JOINed with the phlebo's own stock.

    Each item includes:
      - quantity (0 if no stock row exists)
      - used_today: count of items consumed today from stock
        (per_tube = samples collected today with that tube_type_code;
         per_collection = samples collected today count)
    """
    _require_phlebo(user)
    phlebo_id = user.get("sub")

    # 1. Fetch all active kit items
    items = _rows(
        supabase.table("kit_items")
        .select("*")
        .eq("is_active", True)
        .order("code")
        .execute()
    )

    # 2. Fetch phlebo's stock rows
    stock_rows = _rows(
        supabase.table("phlebo_stock")
        .select("*")
        .eq("phlebotomist_user_id", phlebo_id)
        .execute()
    )
    stock_map = {s["item_code"]: s["quantity"] for s in stock_rows}

    # 3. Compute used_today for each item
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()

    # Samples collected today by this phlebo
    today_samples = _rows(
        supabase.table("samples")
        .select("id, expected_tube_type_code, tube_type_code")
        .eq("phlebotomist_user_id", phlebo_id)
        .gte("collected_at", today_start)
        .execute()
    )

    # per_collection items: just count of samples collected today
    collected_today_count = len(today_samples)

    # per_tube items: count per tube_type_code
    per_tube_used: dict = {}
    for s in today_samples:
        tube_code = s.get("tube_type_code") or s.get("expected_tube_type_code", "")
        if tube_code:
            per_tube_used[tube_code] = per_tube_used.get(tube_code, 0) + 1

    # 4. Build result
    result = []
    for item in items:
        code = item["code"]
        decrement_event = item.get("decrement_event", "never")

        if decrement_event == "per_tube":
            used_today = per_tube_used.get(code, 0)
        elif decrement_event == "per_collection":
            used_today = collected_today_count
        else:
            used_today = 0

        result.append({
            "code": code,
            "name": item["name"],
            "category": item["category"],
            "cap_colour": item.get("cap_colour", ""),
            "decrement_event": decrement_event,
            "quantity": stock_map.get(code, 0),
            "used_today": used_today,
        })

    return {"items": result, "count": len(result)}


# ─── POST — upsert phlebo's stock for one item ────────────────────────────

@router.post("")
async def upsert_stock(
    body: UpsertStockRequest,
    user: dict = Depends(get_current_user),
):
    """Set (or update) the phlebo's stock count for a single kit item."""
    _require_phlebo(user)
    phlebo_id = user.get("sub")

    # Validate the item exists
    item = _first(
        supabase.table("kit_items")
        .select("code")
        .eq("code", body.item_code)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if not item:
        raise HTTPException(404, f"Kit item '{body.item_code}' not found or inactive.")

    # Upsert: INSERT ... ON CONFLICT UPDATE
    existing = _rows(
        supabase.table("phlebo_stock")
        .select("*")
        .eq("phlebotomist_user_id", phlebo_id)
        .eq("item_code", body.item_code)
        .limit(1)
        .execute()
    )

    now = _now_iso()
    if existing:
        supabase.table("phlebo_stock").update({
            "quantity": body.quantity,
            "updated_at": now,
        }).eq("phlebotomist_user_id", phlebo_id).eq("item_code", body.item_code).execute()
    else:
        supabase.table("phlebo_stock").insert({
            "phlebotomist_user_id": phlebo_id,
            "item_code": body.item_code,
            "quantity": body.quantity,
            "updated_at": now,
        }).execute()

    return {
        "success": True,
        "item_code": body.item_code,
        "quantity": body.quantity,
    }


# ─── Auto-decrement helpers (best-effort, clamp at 0) ─────────────────────

def _decrement_per_tube(phlebo_id: str, tube_type_code: str) -> None:
    """Decrement a per_tube kit item by 1. Best-effort, clamp at 0."""
    if not phlebo_id or not tube_type_code:
        return
    try:
        stock = _rows(
            supabase.table("phlebo_stock")
            .select("*")
            .eq("phlebotomist_user_id", phlebo_id)
            .eq("item_code", tube_type_code)
            .limit(1)
            .execute()
        )
        if stock:
            qty = max(0, int(stock[0].get("quantity", 0)) - 1)
            supabase.table("phlebo_stock").update({
                "quantity": qty,
                "updated_at": _now_iso(),
            }).eq("phlebotomist_user_id", phlebo_id).eq("item_code", tube_type_code).execute()
    except Exception as e:
        logger.warning(f"per_tube decrement failed for {phlebo_id}/{tube_type_code}: {e}")


def _decrement_per_collection(phlebo_id: str) -> None:
    """Decrement all per_collection kit items by 1. Best-effort, clamp at 0."""
    if not phlebo_id:
        return
    try:
        consumables = _rows(
            supabase.table("kit_items")
            .select("code")
            .eq("decrement_event", "per_collection")
            .eq("is_active", True)
            .execute()
        )
        for item in consumables:
            code = item["code"]
            stock = _rows(
                supabase.table("phlebo_stock")
                .select("*")
                .eq("phlebotomist_user_id", phlebo_id)
                .eq("item_code", code)
                .limit(1)
                .execute()
            )
            if stock:
                qty = max(0, int(stock[0].get("quantity", 0)) - 1)
                supabase.table("phlebo_stock").update({
                    "quantity": qty,
                    "updated_at": _now_iso(),
                }).eq("phlebotomist_user_id", phlebo_id).eq("item_code", code).execute()
    except Exception as e:
        logger.warning(f"per_collection decrement failed for {phlebo_id}: {e}")


def decrement_for_collection(phlebo_id: str, tube_type_code: str = "") -> None:
    """Call this after a sample is collected/registered.

    Decrements:
      - per_tube items: the tube whose code matches `tube_type_code`
      - per_collection items: one of each (needle, swabs, plaster, etc.)

    Best-effort — never raises.
    """
    _decrement_per_tube(phlebo_id, tube_type_code)
    _decrement_per_collection(phlebo_id)