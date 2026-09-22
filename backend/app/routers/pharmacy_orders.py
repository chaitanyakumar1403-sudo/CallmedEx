"""
Pharmacy Orders Router (Phase 3)
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from app.middleware.auth import get_current_user
from app.database import supabase
from app.services.pharmacy import PharmacyService
from app.utils.personas import is_test_persona
from app.models.schemas import PharmacyInventoryCreate, PharmacyInventoryUpdate
from app.utils.db_helpers import _rows
import uuid
import logging


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pharmacy", tags=["Pharmacy Phase 3"])


@router.get("/search")
async def search_pharmacies(
    city: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(20, le=50),
):
    """Public endpoint: search for registered pharmacies."""
    if not supabase:
        return {"success": True, "pharmacies": []}

    try:
        query = (
            supabase.table("pharmacies")
            .select("*, users!inner(id, full_name, city, district, state, address, email, owner_email, registrant_role)")
            .in_("verification_status", ["verified", "pending"])
        )

        if city:
            query = query.ilike("users.city", f"%{city}%")
        if q:
            query = query.ilike("pharmacy_name", f"%{q}%")

        result = query.limit(limit).execute()
        pharmacies_raw = [p for p in (result.data or []) if not is_test_persona(p.get("users") or {})]

        enriched = []
        for p in pharmacies_raw:
            user = p.get("users", {}) or {}
            enriched.append({
                "id": p.get("id", ""),
                "user_id": user.get("id", ""),
                "name": p.get("pharmacy_name", ""),
                "pharmacy_name": p.get("pharmacy_name", ""),
                "pharmacy_type": p.get("pharmacy_type", "retail"),
                "address": user.get("address", ""),
                "city": user.get("city", ""),
                "district": user.get("district", ""),
                "state": user.get("state", ""),
                "operating_hours": p.get("operating_hours", ""),
                "home_delivery": p.get("home_delivery", False),
                "available_24x7": p.get("available_24x7", False),
                "service_radius_km": p.get("service_radius_km", 5),
                "drug_license_number": p.get("drug_license_number", ""),
                "verification_status": p.get("verification_status", "pending"),
            })

        return {"success": True, "pharmacies": enriched}
    except Exception as e:
        logger.error(f"Error searching pharmacies: {e}")
        return {"success": True, "pharmacies": []}


class OrderItem(BaseModel):
    name: str
    quantity: int

class OrderStatusUpdate(BaseModel):
    status: str

class PlaceOrderRequest(BaseModel):
    prescription_url: Optional[str] = None
    medicines_list: List[OrderItem] = []
    delivery_address: str
    patient_lat: float
    patient_lng: float

@router.post("/order")
async def place_order(req: PlaceOrderRequest, current_user: dict = Depends(get_current_user)):
    """Patient places a pharmacy order (Dark Store Model)."""
    if not supabase:
        return {"success": True, "message": "Simulated order placement", "order_id": str(uuid.uuid4())}
        
    pharmacy_id = PharmacyService.match_nearest_pharmacy(req.patient_lat, req.patient_lng)
    
    if not pharmacy_id:
        raise HTTPException(status_code=400, detail="No serviceable pharmacies found in your area")

    order_id = str(uuid.uuid4())
    
    order_data = {
        "id": order_id,
        "patient_id": current_user["sub"],
        "pharmacy_id": pharmacy_id,
        "prescription_url": req.prescription_url,
        "medicines_list": [item.dict() for item in req.medicines_list],
        "status": "confirmed",
        "delivery_address": req.delivery_address,
        "patient_lat": req.patient_lat,
        "patient_lng": req.patient_lng,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    supabase.table("pharmacy_orders").insert(order_data).execute()
    
    return {
        "success": True, 
        "message": "Order confirmed and sent to pharmacy",
        "order_id": order_id,
        "assigned_pharmacy_id": pharmacy_id
    }

def _my_pharmacy_ids(user_id: str) -> List[str]:
    """pharmacy_orders.pharmacy_id holds pharmacies.id; inventory keys on users.id."""
    rows = _rows(supabase.table("pharmacies").select("id").eq("user_id", user_id).execute())
    return [r["id"] for r in rows if r.get("id")]


@router.get("/orders/incoming")
async def get_incoming_orders(current_user: dict = Depends(get_current_user)):
    """The calling pharmacy's own orders (admins see every pharmacy's)."""
    if current_user.get("role") not in ["pharmacy", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not supabase:
        return {"success": True, "orders": []}

    query = supabase.table("pharmacy_orders").select("*").order("created_at", desc=True)
    if current_user.get("role") == "pharmacy":
        # This used to return every pharmacy's orders — patient delivery
        # addresses and prescriptions included — to any pharmacy login.
        ids = _my_pharmacy_ids(current_user["sub"])
        if not ids:
            return {"success": True, "orders": []}
        query = query.in_("pharmacy_id", ids)
    orders = _rows(query.execute())

    patient_ids = list({o["patient_id"] for o in orders if o.get("patient_id")})
    people = {}
    if patient_ids:
        people = {
            u["id"]: u for u in _rows(
                supabase.table("users").select("id, full_name, mobile").in_("id", patient_ids).execute()
            )
        }
    for o in orders:
        u = people.get(o.get("patient_id"), {})
        o["patient_name"] = u.get("full_name") or ""
        o["patient_phone"] = u.get("mobile") or ""
    return {"success": True, "orders": orders}


# Allowed forward moves of an order. Anything else (skipping packing, reviving
# a delivered order) is refused rather than silently written.
_ORDER_FLOW = {
    "pending": {"confirmed", "cancelled"},
    "confirmed": {"preparing", "cancelled"},
    "preparing": {"out_for_delivery", "cancelled"},
    "out_for_delivery": {"delivered"},
}


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, req: OrderStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Pharmacy moves its own order along confirmed -> preparing -> out_for_delivery -> delivered."""
    if current_user.get("role") not in ["pharmacy", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    rows = _rows(supabase.table("pharmacy_orders").select("id, pharmacy_id, status").eq("id", order_id).limit(1).execute())
    if not rows:
        raise HTTPException(status_code=404, detail="Order not found")
    order = rows[0]
    if current_user.get("role") == "pharmacy" and order.get("pharmacy_id") not in _my_pharmacy_ids(current_user["sub"]):
        raise HTTPException(status_code=404, detail="Order not found")

    current = order.get("status") or "pending"
    if req.status not in _ORDER_FLOW.get(current, set()):
        raise HTTPException(status_code=409, detail=f"An order that is '{current}' cannot move to '{req.status}'.")

    supabase.table("pharmacy_orders").update({
        "status": req.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", order_id).execute()
    return {"success": True, "message": "Order status updated", "status": req.status}


@router.get("/track/{order_id}")
async def track_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Track delivery status of an order."""
    if not supabase:
        return {"success": True, "status": "out_for_delivery"}

    res = supabase.table("pharmacy_orders").select("*").eq("id", order_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = res.data[0]
    # Simple security check
    if order["patient_id"] != current_user["sub"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    return {"success": True, "order": order}

# ─── Inventory Management ─────────────────────────────────────────────────
#
# pharmacy_inventory's columns are sku (NOT NULL), name, generic_name,
# category, unit_price, stock_quantity, requires_prescription, batch_number,
# discount_percentage. The endpoints used to write price / description /
# is_prescription_required — columns that do not exist — and swallowed the
# error, so every "Item added" was a lie and the inventory stayed empty.
# Clients keep their field names; they are mapped onto the real columns here,
# and responses carry both spellings.

def _inventory_out(row: dict) -> dict:
    return {
        **row,
        "price": float(row.get("unit_price") or 0),
        "is_prescription_required": bool(row.get("requires_prescription")),
        "description": row.get("generic_name") or "",
    }


def _make_sku(name: str) -> str:
    stem = "".join(ch if ch.isalnum() else "-" for ch in name.upper())
    stem = "-".join(p for p in stem.split("-") if p)[:24] or "SKU"
    return f"{stem}-{uuid.uuid4().hex[:4].upper()}"


def _inventory_row(item, pharmacy_user_id: str, now: str) -> dict:
    name = (item.name or "").strip()
    return {
        "pharmacy_id": pharmacy_user_id,
        "sku": (getattr(item, "sku", None) or "").strip() or _make_sku(name),
        "name": name,
        "generic_name": (getattr(item, "generic_name", None) or item.description or "").strip(),
        "category": (item.category or "medicine").strip(),
        "unit_price": round(float(item.price), 2),
        "stock_quantity": int(item.stock_quantity),
        "requires_prescription": bool(item.is_prescription_required),
        "batch_number": (getattr(item, "batch_number", None) or "").strip(),
        "updated_at": now,
    }


@router.get("/inventory")
async def get_inventory(current_user: dict = Depends(get_current_user)):
    """Fetch the pharmacy's inventory."""
    if current_user.get("role") not in ["pharmacy", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not supabase:
        return {"success": True, "inventory": []}

    rows = _rows(
        supabase.table("pharmacy_inventory").select("*")
        .eq("pharmacy_id", current_user["sub"]).order("name").execute()
    )
    return {"success": True, "inventory": [_inventory_out(r) for r in rows]}

@router.post("/inventory")
async def add_inventory_item(req: PharmacyInventoryCreate, current_user: dict = Depends(get_current_user)):
    """Add a new item to the pharmacy inventory."""
    if current_user.get("role") not in ["pharmacy", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    now = datetime.now(timezone.utc).isoformat()
    row = {"id": str(uuid.uuid4()), **_inventory_row(req, current_user["sub"], now), "created_at": now}
    try:
        supabase.table("pharmacy_inventory").insert(row).execute()
    except Exception as e:
        logger.error(f"Inventory insert failed: {e}")
        raise HTTPException(status_code=500, detail="Could not save this medicine. Please try again.")
    return {"success": True, "message": "Item added to inventory", "item": _inventory_out(row)}

@router.patch("/inventory/{item_id}")
async def update_inventory_item(item_id: str, req: PharmacyInventoryUpdate, current_user: dict = Depends(get_current_user)):
    """Update stock, price or details of an inventory item."""
    if current_user.get("role") not in ["pharmacy", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    update_data = {}
    if req.price is not None: update_data["unit_price"] = round(float(req.price), 2)
    if req.stock_quantity is not None: update_data["stock_quantity"] = req.stock_quantity
    if req.is_prescription_required is not None: update_data["requires_prescription"] = req.is_prescription_required
    if req.name is not None: update_data["name"] = req.name.strip()
    if req.generic_name is not None: update_data["generic_name"] = req.generic_name.strip()
    if req.category is not None: update_data["category"] = req.category.strip()
    if req.batch_number is not None: update_data["batch_number"] = req.batch_number.strip()
    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    res = supabase.table("pharmacy_inventory").update(update_data).eq("id", item_id).eq("pharmacy_id", current_user["sub"]).execute()
    updated = _rows(res)
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True, "message": "Inventory updated", "item": _inventory_out(updated[0])}

@router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str, current_user: dict = Depends(get_current_user)):
    """Remove an item from inventory."""
    if current_user.get("role") not in ["pharmacy", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    res = supabase.table("pharmacy_inventory").delete().eq("id", item_id).eq("pharmacy_id", current_user["sub"]).execute()
    if not _rows(res):
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True, "message": "Item removed from inventory"}


class BulkImportSKU(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = ""
    generic_name: Optional[str] = None
    sku: Optional[str] = None
    batch_number: Optional[str] = None
    price: float = Field(..., gt=0)
    stock_quantity: int = Field(..., ge=0)
    category: Optional[str] = "medicine"
    is_prescription_required: Optional[bool] = False


class BulkImportRequest(BaseModel):
    items: List[BulkImportSKU] = Field(..., min_length=1, max_length=5000)


@router.post("/inventory/bulk-import")
async def bulk_import_inventory(req: BulkImportRequest, current_user: dict = Depends(get_current_user)):
    """Import a spreadsheet of medicines. A row matching an existing SKU (or,
    without a SKU, an existing medicine name) updates its price and stock, so
    re-uploading a refreshed sheet does not duplicate the catalogue."""
    if current_user.get("role") not in ["pharmacy", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    uid = current_user["sub"]
    now = datetime.now(timezone.utc).isoformat()
    existing = _rows(supabase.table("pharmacy_inventory").select("id, sku, name").eq("pharmacy_id", uid).execute())
    by_sku = {(r.get("sku") or "").strip().lower(): r["id"] for r in existing if r.get("sku")}
    by_name = {(r.get("name") or "").strip().lower(): r["id"] for r in existing if r.get("name")}

    inserts, updated = [], 0
    seen = set()
    for item in req.items:
        row = _inventory_row(item, uid, now)
        sku_key = (item.sku or "").strip().lower()
        key = sku_key or row["name"].lower()
        if key in seen:
            continue  # the same medicine twice in one sheet: first row wins
        seen.add(key)
        match = by_sku.get(sku_key) if sku_key else by_name.get(row["name"].lower())
        if match:
            upd = {k: v for k, v in row.items() if k not in ("pharmacy_id", "sku")}
            supabase.table("pharmacy_inventory").update(upd).eq("id", match).eq("pharmacy_id", uid).execute()
            updated += 1
        else:
            inserts.append({"id": str(uuid.uuid4()), **row, "created_at": now})

    try:
        for i in range(0, len(inserts), 500):
            supabase.table("pharmacy_inventory").insert(inserts[i:i + 500]).execute()
    except Exception as e:
        logger.error(f"Bulk inventory insert failed: {e}")
        raise HTTPException(status_code=500, detail="The import could not be saved. No new medicines were added.")

    return {
        "success": True,
        "count": len(inserts) + updated,
        "created": len(inserts),
        "updated": updated,
        "message": f"Imported {len(inserts)} new medicine(s), updated {updated} existing.",
    }


# ═══════════════════════════════════════════════════════════════════════════
# GENERIC SAVINGS LEDGER (§8.7)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/savings")
async def get_patient_generic_savings(current_user: dict = Depends(get_current_user)):
    """
    Generic Savings Ledger (§8.7):
    Calculates lifetime, year-to-date, and per-order savings from choosing
    verified generic medicines over branded equivalents.
    """
    if not supabase:
        return {
            "success": True,
            "lifetime_saved": 0.0,
            "year_to_date": 0.0,
            "last_order_saved": 0.0,
            "orders_count": 0,
            "breakdown": [],
        }

    patient_id = current_user["sub"]
    current_year = datetime.now(timezone.utc).year

    try:
        order_rows = _rows(
            supabase.table("pharmacy_orders")
            .select("*")
            .eq("patient_id", patient_id)
            .order("created_at", desc=True)
            .execute()
        )
        if not order_rows:
            order_rows = _rows(
                supabase.table("orders")
                .select("*")
                .eq("patient_id", patient_id)
                .order("created_at", desc=True)
                .execute()
            )
    except Exception:
        order_rows = []

    lifetime_saved = 0.0
    year_to_date = 0.0
    last_order_saved = 0.0
    breakdown = []

    for idx, ord in enumerate(order_rows):
        items = ord.get("items") or ord.get("medicines_list") or []
        if isinstance(items, str):
            import json
            try:
                items = json.loads(items)
            except Exception:
                items = []

        order_saved = 0.0
        for it in items:
            price = float(it.get("price") or 0.0)
            # If branded_mrp is recorded use it, else generic standard baseline savings
            branded_mrp = float(it.get("branded_mrp") or (price * 1.65))
            qty = int(it.get("quantity") or 1)
            item_saved = max(0.0, (branded_mrp - price) * qty)
            order_saved += item_saved


        lifetime_saved += order_saved

        # Check calendar year
        created_at_str = ord.get("created_at", "")
        if created_at_str and str(current_year) in created_at_str:
            year_to_date += order_saved

        if idx == 0:
            last_order_saved = order_saved

        if order_saved > 0:
            breakdown.append({
                "order_id": ord.get("id"),
                "date": created_at_str[:10],
                "order_total": ord.get("total_amount"),
                "saved_amount": round(order_saved, 2),
                "item_count": len(items),
            })

    return {
        "success": True,
        "lifetime_saved": round(lifetime_saved, 2),
        "year_to_date": round(year_to_date, 2),
        "last_order_saved": round(last_order_saved, 2),
        "orders_count": len(order_rows),
        "currency": "INR",
        "breakdown": breakdown[:10],
    }


