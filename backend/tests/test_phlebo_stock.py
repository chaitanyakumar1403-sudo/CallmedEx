"""
Task 5: Phlebo kit & stock tracking (DoctorC "Current Equipment" model).

Exercises:
  1. Seed integrity: all expected kit_items exist.
  2. GET returns all active items with quantity (0 for unstocked).
  3. POST upserts the phlebo's own stock row.
  4. POST rejects invalid item_code.
  5. per_tube decrement on scan-tube path (via _bind_barcode).
  6. per_collection decrement once per sample registered.
  7. Clamp at 0 — never go negative.
  8. used_today math — per_tube and per_collection counts work.
"""
import uuid

import pytest

from app.routers import phlebo_doorstep as doorstep_mod
from app.routers import phlebo_stock as stock_mod
from tests.test_sample_lifecycle import FakeSupabase


# ── Extended Fake with gte support ─────────────────────────────────────────

class FakeQueryWithGte:
    """A minimal query builder for stock tests — extends the base FakeQuery
    with `.gte()` support so `stock_mod`'s today-filtered query can run."""

    def __init__(self, db, table_name):
        self.db, self.table_name = db, table_name
        self.filters, self.limit_n = [], None
        self._op = "select"
        self._payload = None

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def insert(self, payload):
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload):
        self._op, self._payload = "update", payload
        return self

    def eq(self, col, val):
        self.filters.append(("eq", col, val))
        return self

    def neq(self, col, val):
        self.filters.append(("neq", col, val))
        return self

    def in_(self, col, vals):
        self.filters.append(("in", col, list(vals)))
        return self

    def gte(self, col, val):
        """gte — greater than or equal (string/iso comparison)."""
        self.filters.append(("gte", col, val))
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, n):
        self.limit_n = n
        return self

    def _matches(self, row):
        for kind, col, val in self.filters:
            if kind == "eq" and row.get(col) != val:
                return False
            if kind == "neq" and row.get(col) == val:
                return False
            if kind == "in" and row.get(col) not in val:
                return False
            if kind == "gte":
                rv = row.get(col)
                if rv is None or rv < val:
                    return False
        return True

    def execute(self):
        rows = self.db.setdefault(self.table_name, [])
        if self._op == "insert":
            payload = self._payload
            records = payload if isinstance(payload, list) else [payload]
            for rec in records:
                rec.setdefault("id", str(uuid.uuid4()))
                rows.append(dict(rec))
            return _fake_result(records)
        matched = [r for r in rows if self._matches(r)]
        if self._op == "update":
            for r in matched:
                r.update(self._payload)
            return _fake_result(matched)
        if self.limit_n is not None:
            matched = matched[: self.limit_n]
        return _fake_result([dict(r) for r in matched])


class FakeSupabaseGte(FakeSupabase):
    """Like FakeSupabase but tables use FakeQueryWithGte for gte support."""

    def table(self, name):
        return FakeQueryWithGte(self.db, name)


def _fake_result(data):
    class R:
        def __init__(self, d):
            self.data = d
    return R(data)


# ── Helpers ─────────────────────────────────────────────────────────────────

KIT_CODES = [
    "edta_lavender", "sst_gold", "citrate_blue", "fluoride_grey", "plain_red",
    "urine_container", "needle", "alcohol_swabs", "injection_plaster",
    "gloves_large", "syringe_2_5ml", "syringe_5ml", "sterillium_small",
]


def _seed_kit_items(fake):
    """Seed the kit_items catalog."""
    cats = {
        "edta_lavender": "tube", "sst_gold": "tube", "citrate_blue": "tube",
        "fluoride_grey": "tube", "plain_red": "tube",
        "urine_container": "container",
        "needle": "consumable", "alcohol_swabs": "consumable",
        "injection_plaster": "consumable", "gloves_large": "consumable",
        "syringe_2_5ml": "consumable", "syringe_5ml": "consumable",
        "sterillium_small": "consumable",
    }
    dec = {
        "edta_lavender": "per_tube", "sst_gold": "per_tube",
        "citrate_blue": "per_tube", "fluoride_grey": "per_tube",
        "plain_red": "per_tube",
        "urine_container": "per_collection", "needle": "per_collection",
        "alcohol_swabs": "per_collection", "injection_plaster": "per_collection",
        "gloves_large": "per_collection", "syringe_2_5ml": "per_collection",
        "syringe_5ml": "per_collection", "sterillium_small": "per_collection",
    }
    colours = {
        "edta_lavender": "lavender", "sst_gold": "gold", "citrate_blue": "blue",
        "fluoride_grey": "grey", "plain_red": "red", "urine_container": "yellow",
    }
    for code in KIT_CODES:
        fake.db.setdefault("kit_items", []).append({
            "code": code,
            "name": code.replace("_", " ").title(),
            "category": cats[code],
            "cap_colour": colours.get(code, ""),
            "decrement_event": dec[code],
            "is_active": True,
        })


def _seed_sample(fake, sample_id, phlebo_id, tube_code="edta_lavender",
                 collected_at=None):
    if collected_at is None:
        collected_at = datetime.now(timezone.utc).isoformat()
    fake.db.setdefault("samples", []).append({
        "id": sample_id,
        "barcode": f"CMX-TEST-{sample_id[:8].upper()}",
        "phlebotomist_user_id": phlebo_id,
        "expected_tube_type_code": tube_code,
        "tube_type_code": tube_code,
        "status": "collected",
        "collected_at": collected_at,
        "booking_id": str(uuid.uuid4()),
        "patient_id": str(uuid.uuid4()),
    })


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabaseGte()
    monkeypatch.setattr(stock_mod, "supabase", fake)
    # The scan-tube endpoint also accesses supabase through doorstep_mod
    monkeypatch.setattr(doorstep_mod, "supabase", fake)
    _seed_kit_items(fake)
    return fake


def _phlebo_user(uid=None):
    return {"sub": uid or str(uuid.uuid4()), "role": "phlebotomist"}


# ── 1. Seed integrity ──────────────────────────────────────────────────────

def test_seed_kit_items_exist(fake_db):
    items = fake_db.db.get("kit_items", [])
    codes = {i["code"] for i in items}
    for code in KIT_CODES:
        assert code in codes, f"Missing kit item: {code}"


# ── 2. GET returns all active items with quantity 0 ────────────────────────

@pytest.mark.asyncio
async def test_get_stock_returns_all_items(fake_db):
    user = _phlebo_user()
    result = await stock_mod.get_stock(user=user)
    assert result["count"] == len(KIT_CODES)
    for item in result["items"]:
        assert item["quantity"] == 0
        assert item["used_today"] == 0


# ── 3. POST upserts own stock ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upsert_own_stock(fake_db):
    user = _phlebo_user()
    # Insert stock
    result = await stock_mod.upsert_stock(
        stock_mod.UpsertStockRequest(item_code="needle", quantity=50),
        user=user,
    )
    assert result["success"]
    assert result["quantity"] == 50

    # GET should reflect the update
    get_result = await stock_mod.get_stock(user=user)
    needle = next(i for i in get_result["items"] if i["code"] == "needle")
    assert needle["quantity"] == 50


# ── 4. POST rejects invalid item_code ──────────────────────────────────────

@pytest.mark.asyncio
async def test_upsert_invalid_item(fake_db):
    user = _phlebo_user()
    with pytest.raises(Exception):
        await stock_mod.upsert_stock(
            stock_mod.UpsertStockRequest(item_code="nonexistent", quantity=10),
            user=user,
        )


# ── 5. POST cannot write another phlebo's stock ────────────────────────────

@pytest.mark.asyncio
async def test_upsert_isolated_per_phlebo(fake_db):
    phlebo_a = _phlebo_user()
    phlebo_b = _phlebo_user()

    # Phlebo A sets stock
    await stock_mod.upsert_stock(
        stock_mod.UpsertStockRequest(item_code="needle", quantity=20),
        user=phlebo_a,
    )

    # Phlebo B should see 0 for needle
    b_result = await stock_mod.get_stock(user=phlebo_b)
    needle_b = next(i for i in b_result["items"] if i["code"] == "needle")
    assert needle_b["quantity"] == 0


# ── 6. per_tube decrement on scan-tube path ────────────────────────────────

@pytest.mark.asyncio
async def test_per_tube_decrement_on_scan(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = {"sub": phlebo_id, "role": "phlebotomist"}
    sample_id = str(uuid.uuid4())

    # Seed tube type + sample
    fake_db.db.setdefault("tube_types", []).append({
        "code": "edta_lavender", "name": "EDTA Lavender", "cap_colour": "lavender",
        "is_active": True,
    })
    fake_db.db.setdefault("samples", []).append({
        "id": sample_id,
        "barcode": None,
        "expected_tube_type_code": "edta_lavender",
        "tube_type_code": None,
        "status": "pending_collection",
        "booking_id": str(uuid.uuid4()),
        "patient_id": str(uuid.uuid4()),
        "phlebotomist_user_id": phlebo_id,
        "booking_subject_id": None,
        "processing_center_id": None,
        "tube_mismatch_ack": False,
        "created_at": "2026-07-29T00:00:00Z",
    })

    # Stock edta_lavender at 5
    fake_db.db.setdefault("phlebo_stock", []).append({
        "phlebotomist_user_id": phlebo_id,
        "item_code": "edta_lavender",
        "quantity": 5,
        "updated_at": "2026-07-29T10:00:00Z",
    })

    req = doorstep_mod.ScanTubeRequest(
        sample_id=sample_id,
        scanned_tube_type_code="edta_lavender",
        scanned_barcode="CMX-260729-TEST",
    )

    await doorstep_mod.scan_tube(req, user=user)

    # Stock should have decremented
    stock_rows = fake_db.db.get("phlebo_stock", [])
    tube_stock = next(s for s in stock_rows if s["item_code"] == "edta_lavender")
    assert tube_stock["quantity"] == 4


# ── 7. Clamp at 0 — never go negative ──────────────────────────────────────

@pytest.mark.asyncio
async def test_clamp_at_zero(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = {"sub": phlebo_id, "role": "phlebotomist"}

    # Stock at 0
    fake_db.db.setdefault("phlebo_stock", []).append({
        "phlebotomist_user_id": phlebo_id,
        "item_code": "needle",
        "quantity": 0,
        "updated_at": "2026-07-29T10:00:00Z",
    })

    stock_mod._decrement_per_collection(phlebo_id)

    stock_rows = fake_db.db.get("phlebo_stock", [])
    needle = next(s for s in stock_rows if s["item_code"] == "needle")
    assert needle["quantity"] == 0  # Clamped, never -1


# ── 8. used_today math ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_used_today_counts(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = {"sub": phlebo_id, "role": "phlebotomist"}

    # Seed samples collected today — 2 edta_lavender, 1 sst_gold
    _seed_sample(fake_db, str(uuid.uuid4()), phlebo_id, "edta_lavender")
    _seed_sample(fake_db, str(uuid.uuid4()), phlebo_id, "edta_lavender")
    _seed_sample(fake_db, str(uuid.uuid4()), phlebo_id, "sst_gold")

    result = await stock_mod.get_stock(user=user)

    def find(code):
        return next(i for i in result["items"] if i["code"] == code)

    # per_tube items: count per tube type
    assert find("edta_lavender")["used_today"] == 2
    assert find("sst_gold")["used_today"] == 1
    assert find("plain_red")["used_today"] == 0

    # per_collection items: total samples today = 3
    assert find("needle")["used_today"] == 3
    assert find("alcohol_swabs")["used_today"] == 3


# ── 9. per_collection decrement fires via scan-tube ────────────────────────

@pytest.mark.asyncio
async def test_per_collection_decrement_on_scan(fake_db):
    phlebo_id = str(uuid.uuid4())
    user = {"sub": phlebo_id, "role": "phlebotomist"}
    sample_id = str(uuid.uuid4())

    fake_db.db.setdefault("tube_types", []).append({
        "code": "edta_lavender", "name": "EDTA Lavender", "cap_colour": "lavender",
        "is_active": True,
    })
    fake_db.db.setdefault("samples", []).append({
        "id": sample_id,
        "barcode": None,
        "expected_tube_type_code": "edta_lavender",
        "tube_type_code": None,
        "status": "pending_collection",
        "booking_id": str(uuid.uuid4()),
        "patient_id": str(uuid.uuid4()),
        "phlebotomist_user_id": phlebo_id,
        "booking_subject_id": None,
        "processing_center_id": None,
        "tube_mismatch_ack": False,
        "created_at": "2026-07-29T00:00:00Z",
    })

    # Stock per_collection items
    for code in ("needle", "alcohol_swabs", "gloves_large"):
        fake_db.db.setdefault("phlebo_stock", []).append({
            "phlebotomist_user_id": phlebo_id,
            "item_code": code,
            "quantity": 10,
            "updated_at": "2026-07-29T10:00:00Z",
        })

    req = doorstep_mod.ScanTubeRequest(
        sample_id=sample_id,
        scanned_tube_type_code="edta_lavender",
        scanned_barcode="CMX-260729-TEST2",
    )

    await doorstep_mod.scan_tube(req, user=user)

    stock_rows = {s["item_code"]: s["quantity"]
                  for s in fake_db.db.get("phlebo_stock", [])}

    assert stock_rows.get("needle") == 9
    assert stock_rows.get("alcohol_swabs") == 9
    assert stock_rows.get("gloves_large") == 9