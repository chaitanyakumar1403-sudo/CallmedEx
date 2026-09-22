import pytest
from fastapi import HTTPException

import app.routers.pharmacy_orders as po
from app.models.schemas import PharmacyInventoryCreate
from tests.test_sample_lifecycle import FakeSupabase

PHARM_USER = {"sub": "ph-user-1", "role": "pharmacy"}


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase()
    fake.db["pharmacies"] = [{"id": "ph-1", "user_id": "ph-user-1"}, {"id": "ph-2", "user_id": "ph-user-2"}]
    monkeypatch.setattr(po, "supabase", fake)
    return fake


@pytest.mark.asyncio
async def test_inventory_is_written_to_the_real_columns(db):
    res = await po.add_inventory_item(
        PharmacyInventoryCreate(name="Paracetamol 500mg", description="Paracetamol", price=24.5,
                                stock_quantity=120, is_prescription_required=True),
        PHARM_USER,
    )
    row = db.db["pharmacy_inventory"][0]
    assert row["unit_price"] == 24.5 and row["requires_prescription"] is True
    assert row["generic_name"] == "Paracetamol" and row["sku"].startswith("PARACETAMOL-500MG-")
    assert "price" not in row and "is_prescription_required" not in row
    # Old clients (mobile) still read their field names.
    assert res["item"]["price"] == 24.5 and res["item"]["is_prescription_required"] is True


@pytest.mark.asyncio
async def test_bulk_import_updates_existing_instead_of_duplicating(db):
    db.db["pharmacy_inventory"] = [{"id": "i1", "pharmacy_id": "ph-user-1", "sku": "PCM-500", "name": "Paracetamol 500mg",
                                    "unit_price": 20, "stock_quantity": 5}]
    req = po.BulkImportRequest(items=[
        po.BulkImportSKU(name="Paracetamol 500mg", sku="PCM-500", price=22, stock_quantity=300),
        po.BulkImportSKU(name="Cetirizine 10mg", price=18, stock_quantity=90),
    ])
    res = await po.bulk_import_inventory(req, PHARM_USER)
    assert (res["created"], res["updated"]) == (1, 1)
    rows = {r["name"]: r for r in db.db["pharmacy_inventory"]}
    assert rows["Paracetamol 500mg"]["stock_quantity"] == 300 and rows["Paracetamol 500mg"]["sku"] == "PCM-500"
    assert len(rows) == 2


@pytest.mark.asyncio
async def test_pharmacy_sees_only_its_own_orders_and_moves_them_in_order(db):
    db.db["pharmacy_orders"] = [
        {"id": "o-mine", "pharmacy_id": "ph-1", "patient_id": "p1", "status": "confirmed"},
        {"id": "o-other", "pharmacy_id": "ph-2", "patient_id": "p2", "status": "confirmed"},
    ]
    res = await po.get_incoming_orders(PHARM_USER)
    assert [o["id"] for o in res["orders"]] == ["o-mine"]

    with pytest.raises(HTTPException) as e:
        await po.update_order_status("o-other", po.OrderStatusUpdate(status="preparing"), PHARM_USER)
    assert e.value.status_code == 404
    with pytest.raises(HTTPException) as e:
        await po.update_order_status("o-mine", po.OrderStatusUpdate(status="delivered"), PHARM_USER)
    assert e.value.status_code == 409

    await po.update_order_status("o-mine", po.OrderStatusUpdate(status="preparing"), PHARM_USER)
    assert db.db["pharmacy_orders"][0]["status"] == "preparing"
