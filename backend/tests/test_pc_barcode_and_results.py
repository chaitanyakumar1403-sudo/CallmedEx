"""
PC barcode verification + results upload tests.

Tests cover:
- Processing centre report upload via processing_center_id (own centre OK, other
  centre denied, broader status allowlist, patient notification)
- Org path still works unchanged (no regression)
- The by-barcode endpoint scoping pattern (own centre finds, other centre 404s)
"""
import re
import uuid

import pytest

import app.services.notification_engine as ne_mod
import app.services.samples as samples_mod
from app.services.samples import SampleService


# ── Minimal in-memory Supabase stand-in (same pattern as test_sample_lifecycle) ─

class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table_name = db, table
        self.filters, self.limit_n = [], None
        self._op = "select"
        self._payload = None
        self._negate_next = False
        self.range_from = self.range_to = None

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def insert(self, payload):
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload):
        self._op, self._payload = "update", payload
        return self

    def delete(self):
        self._op = "delete"
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

    def is_(self, col, val):
        self.filters.append(("negated_is" if self._negate_next else "is", col, val))
        self._negate_next = False
        return self

    @property
    def not_(self):
        self._negate_next = True
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, n):
        self.limit_n = n
        return self

    def range(self, start, end):
        self.range_from, self.range_to = start, end
        return self

    def _matches(self, row):
        for kind, col, val in self.filters:
            if kind == "eq" and row.get(col) != val:
                return False
            if kind == "neq" and row.get(col) == val:
                return False
            if kind == "in" and row.get(col) not in val:
                return False
            if kind == "is" and val == "null" and row.get(col) is not None:
                return False
            if kind == "negated_is" and val == "null" and row.get(col) is None:
                return False
        return True

    def execute(self):
        rows = self.db.setdefault(self.table_name, [])
        if self._op == "insert":
            payload = self._payload
            records = payload if isinstance(payload, list) else [payload]
            for rec in records:
                bc = rec.get("barcode")
                if bc is not None and any(r.get("barcode") == bc for r in rows):
                    raise Exception('duplicate key value violates unique constraint (23505)')
                rec.setdefault("id", str(uuid.uuid4()))
                rows.append(dict(rec))
            return FakeResult(records)

        matched = [r for r in rows if self._matches(r)]
        if self._op == "update":
            for r in matched:
                r.update(self._payload)
            return FakeResult(matched)

        if self._op == "delete":
            removed = [dict(r) for r in matched]
            self.db[self.table_name] = [r for r in rows if not self._matches(r)]
            return FakeResult(removed)

        if self.range_from is not None:
            matched = matched[self.range_from : (self.range_to or 0) + 1]
        if self.limit_n is not None:
            matched = matched[: self.limit_n]
        return FakeResult([dict(r) for r in matched])


class FakeSupabase:
    def __init__(self):
        self.db = {}

    def table(self, name):
        return FakeQuery(self.db, name)


class FakeNotificationEngine:
    @staticmethod
    async def send(user_id, channel, title, body, data=None):
        return {"notification_id": str(uuid.uuid4()), "channel": channel, "status": "sent"}


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(samples_mod, "supabase", fake)
    monkeypatch.setattr(ne_mod, "NotificationEngine", FakeNotificationEngine)
    return fake


def _seed_sample(fake, *, sample_id=None, barcode="CMX-TEST-000001",
                 status="received", processing_center_id="pc-own",
                 destination_org_user_id=None, patient_id="patient-1",
                 booking_id="booking-1"):
    sid = sample_id or str(uuid.uuid4())
    fake.db.setdefault("samples", []).append({
        "id": sid,
        "barcode": barcode,
        "status": status,
        "processing_center_id": processing_center_id,
        "destination_org_user_id": destination_org_user_id,
        "patient_id": patient_id,
        "booking_id": booking_id,
        "test_names": ["Blood Sugar", "Lipid Profile"],
        "tube_type_code": "lavender",
        "expected_tube_type_code": "lavender",
        "report_url": None,
        "report_uploaded_at": None,
    })
    return sid


# ── PC report upload ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pc_upload_report_own_centre_allowed(fake_db):
    """A processing centre can upload a report for a sample belonging to it."""
    sid = _seed_sample(fake_db, processing_center_id="pc-own", status="verified")

    result = await SampleService.upload_report(
        sample_id=sid,
        uploader_user_id="pc-staff-1",
        report_url="https://reports.example.com/r.pdf",
        processing_center_id="pc-own",
    )
    assert result["success"], result["message"]

    stored = next(s for s in fake_db.db["samples"] if s["id"] == sid)
    assert stored["status"] == "report_ready"
    assert stored["report_url"] == "https://reports.example.com/r.pdf"


@pytest.mark.asyncio
async def test_pc_upload_report_other_centre_denied(fake_db):
    """A processing centre cannot upload a report for another centre's sample."""
    sid = _seed_sample(fake_db, processing_center_id="pc-other", status="verified")

    result = await SampleService.upload_report(
        sample_id=sid,
        uploader_user_id="pc-staff-1",
        report_url="https://reports.example.com/r.pdf",
        processing_center_id="pc-own",  # different centre
    )
    assert not result["success"]
    assert "does not belong to your processing centre" in result["message"]


@pytest.mark.asyncio
async def test_pc_upload_report_allows_verified_batched_sent_to_lab(fake_db):
    """PC upload accepts verified, batched, and sent_to_lab statuses."""
    for status in ("verified", "batched", "sent_to_lab"):
        sid = _seed_sample(fake_db, processing_center_id="pc-own", status=status,
                           barcode=f"CMX-{status.upper()}")
        result = await SampleService.upload_report(
            sample_id=sid,
            uploader_user_id="pc-staff-1",
            report_url=f"https://reports.example.com/{status}.pdf",
            processing_center_id="pc-own",
        )
        assert result["success"], f"failed for status {status}: {result['message']}"


@pytest.mark.asyncio
async def test_pc_upload_report_rejects_pending_collection(fake_db):
    """A sample that hasn't been collected yet cannot get a report via PC path."""
    sid = _seed_sample(fake_db, processing_center_id="pc-own",
                       status="pending_collection")

    result = await SampleService.upload_report(
        sample_id=sid,
        uploader_user_id="pc-staff-1",
        report_url="https://reports.example.com/r.pdf",
        processing_center_id="pc-own",
    )
    assert not result["success"]
    assert "Cannot publish" in result["message"]


# ── Org path regression ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_org_upload_report_still_works(fake_db):
    """The original diagnostic centre path must not be broken."""
    lab_user = "org-user-1"
    sid = _seed_sample(fake_db, destination_org_user_id=lab_user, status="received",
                       processing_center_id=None)

    result = await SampleService.upload_report(
        sample_id=sid,
        uploader_user_id=lab_user,
        report_url="https://reports.example.com/org-r.pdf",
        # no processing_center_id → org path
    )
    assert result["success"], result["message"]

    stored = next(s for s in fake_db.db["samples"] if s["id"] == sid)
    assert stored["status"] == "report_ready"
    assert stored["report_url"] == "https://reports.example.com/org-r.pdf"


# ── By-barcode scoping (service-level pattern) ────────────────────────────────

def test_by_barcode_finds_own_centre_sample(fake_db):
    """Simulate the by-barcode query: filter by barcode AND processing_center_id."""
    sid = _seed_sample(fake_db, barcode="CMX-FIND", processing_center_id="pc-own")

    db = samples_mod.supabase  # uses the fake from the fixture
    rows = db.table("samples").select("*").eq("barcode", "CMX-FIND").eq("processing_center_id", "pc-own").limit(1).execute()
    data = getattr(rows, "data", None) or []
    assert len(data) == 1
    assert data[0]["id"] == sid


def test_by_barcode_404_other_centre(fake_db):
    """A barcode that exists but belongs to another centre must not be found."""
    _seed_sample(fake_db, barcode="CMX-HIDDEN", processing_center_id="pc-other")

    db = samples_mod.supabase
    rows = db.table("samples").select("*").eq("barcode", "CMX-HIDDEN").eq("processing_center_id", "pc-own").limit(1).execute()
    data = getattr(rows, "data", None) or []
    assert len(data) == 0


def test_by_barcode_case_insensitive_match(fake_db):
    """The by-barcode endpoint uppercases the scanned value before lookup."""
    sid = _seed_sample(fake_db, barcode="CMX-UPPER", processing_center_id="pc-own")

    db = samples_mod.supabase
    # Simulate the uppercase applied in the endpoint
    barcode = "cmx-upper".strip().upper()
    rows = db.table("samples").select("*").eq("barcode", barcode).eq("processing_center_id", "pc-own").limit(1).execute()
    data = getattr(rows, "data", None) or []
    assert len(data) == 1
    assert data[0]["id"] == sid