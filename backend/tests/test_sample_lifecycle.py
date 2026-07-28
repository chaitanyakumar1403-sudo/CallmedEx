"""
Sample lifecycle + wallet tests.

These exercise the money-handling and custody paths against an in-memory stand-in
for the Supabase client, so the payout rules from the phlebotomist MOUs are
verified rather than assumed:

  - Part-time phlebotomists are paid per ACCEPTED tube only.
  - Rejected tubes pay nothing.
  - Full-time phlebotomists are salaried and accrue no per-collection credit.
  - A retried handover acceptance must not pay twice.
"""
import re
import uuid

import pytest

import app.services.wallet as wallet_mod
import app.services.samples as samples_mod
from app.services.wallet import WalletService
from app.services.samples import SampleService


# ── Minimal in-memory Supabase stand-in ──────────────────────────────────────

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

    # -- builders --
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
        """Supports the PostgREST `.not_.is_(col, "null")` form the engine uses."""
        self._negate_next = True
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, n):
        self.limit_n = n
        return self

    def range(self, start, end):
        """PostgREST-style inclusive range, used for paged catalogue loads."""
        self.range_from, self.range_to = start, end
        return self

    # -- execution --
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
                # Enforce the DB's uniqueness guarantees that the code relies on.
                if self.table_name == "samples":
                    # Barcode is nullable now — bound at scan, not at booking.
                    bc = rec.get("barcode")
                    if bc is not None and any(r.get("barcode") == bc for r in rows):
                        raise Exception('duplicate key value violates unique constraint (23505)')
                if self.table_name == "wallet_transactions" and rec.get("sample_id") and rec.get("direction") == "credit":
                    dup = any(
                        r.get("sample_id") == rec["sample_id"]
                        and r.get("reason") == rec["reason"]
                        and r.get("direction") == "credit"
                        for r in rows
                    )
                    if dup:
                        raise Exception("duplicate key value violates unique constraint (23505)")
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


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(wallet_mod, "supabase", fake)
    monkeypatch.setattr(samples_mod, "supabase", fake)
    return fake


def _seed_phlebo(fake, user_id, rate, phleb_type="part_time", home_lab=None):
    fake.db.setdefault("phlebotomists", []).append({
        "user_id": user_id,
        "per_collection_rate": rate,
        "phleb_type": phleb_type,
        "home_lab_org_user_id": home_lab,
    })


def _seed_org(fake, user_id, name, verification_status="verified"):
    fake.db.setdefault("organizations", []).append({
        "user_id": user_id,
        "organization_name": name,
        "organization_type": "diagnostic_center",
        "verification_status": verification_status,
    })


def _seed_dispatch(fake, phlebo_user_id, patient_id):
    """A run assigned to this collector — the ticket that authorises a tube."""
    did = str(uuid.uuid4())
    fake.db.setdefault("dispatch_requests", []).append({
        "id": did,
        "patient_id": patient_id,
        "assigned_provider_id": phlebo_user_id,
        "status": "arrived",
    })
    return did


async def _collect(fake, phlebo, patient, **kwargs):
    """Collect against a freshly-seeded run assigned to this phlebotomist."""
    did = kwargs.pop("dispatch_request_id", None) or _seed_dispatch(fake, phlebo, patient)
    return await SampleService.collect(
        phlebotomist_user_id=phlebo,
        patient_id=patient,
        dispatch_request_id=did,
        **kwargs,
    )


# ── Barcode ──────────────────────────────────────────────────────────────────

def test_barcode_format_and_uniqueness(fake_db):
    a = SampleService.generate_barcode()
    assert re.fullmatch(r"CMX-\d{6}-[0-9A-F]{6}", a), a
    # Once a barcode is taken, a fresh one must differ.
    fake_db.db["samples"] = [{"id": "x", "barcode": a}]
    assert SampleService.generate_barcode() != a


# ── Wallet ledger ────────────────────────────────────────────────────────────

def test_wallet_balance_is_derived_from_ledger(fake_db):
    p = str(uuid.uuid4())
    WalletService.credit(p, 150, "collection_payout", sample_id="s1")
    WalletService.credit(p, 150, "collection_payout", sample_id="s2")
    WalletService.debit(p, 50, "penalty")
    assert WalletService.recompute_balance(p) == 250.0

    summary = WalletService.get_summary(p)
    assert summary["balance"] == 250.0
    assert summary["lifetime_earned"] == 300.0
    assert summary["lifetime_paid"] == 50.0


def test_wallet_credit_is_idempotent_per_sample(fake_db):
    """A retried handover acceptance must not pay the phlebotomist twice."""
    p = str(uuid.uuid4())
    first = WalletService.credit(p, 150, "collection_payout", sample_id="s1")
    second = WalletService.credit(p, 150, "collection_payout", sample_id="s1")

    assert first["success"] and not first.get("duplicate")
    assert second["success"] and second["duplicate"]
    assert WalletService.recompute_balance(p) == 150.0


def test_zero_amount_credit_is_skipped(fake_db):
    """Full-time phlebotomists carry a rate of 0; that must not litter the ledger."""
    p = str(uuid.uuid4())
    result = WalletService.credit(p, 0, "collection_payout", sample_id="s1")
    assert result["success"] and result["skipped"]
    assert fake_db.db.get("wallet_transactions", []) == []


# ── Collection ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_collect_registers_sample_and_custody_event(fake_db):
    phlebo, patient, lab = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, 150, home_lab=lab)

    res = await _collect(fake_db, phlebo, patient, lat=17.7, lng=83.3)
    assert res["success"]
    # Destination defaults to the phlebotomist's home lab.
    assert res["destination_org_user_id"] == lab

    events = fake_db.db["sample_events"]
    assert len(events) == 1 and events[0]["event"] == "collected"
    assert events[0]["lat"] == 17.7


# ── Collection authorisation ─────────────────────────────────────────────────
# A tube filed against the wrong patient becomes a lab report on the wrong
# ABHA-linked record, so the patient is derived from the run, never trusted
# from the request body.

@pytest.mark.asyncio
async def test_collect_requires_a_linked_run(fake_db):
    phlebo, patient = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, 150)

    res = await SampleService.collect(phlebotomist_user_id=phlebo, patient_id=patient)
    assert not res["success"]
    assert "Select the run" in res["message"]
    assert fake_db.db.get("samples", []) == []


@pytest.mark.asyncio
async def test_collect_rejects_another_phlebotomists_run(fake_db):
    mine, theirs, patient = (str(uuid.uuid4()) for _ in range(3))
    _seed_phlebo(fake_db, mine, 150)
    _seed_phlebo(fake_db, theirs, 150)
    their_run = _seed_dispatch(fake_db, theirs, patient)

    res = await SampleService.collect(
        phlebotomist_user_id=mine, patient_id=patient, dispatch_request_id=their_run
    )
    assert not res["success"]
    assert "not assigned to you" in res["message"]
    assert fake_db.db.get("samples", []) == []


@pytest.mark.asyncio
async def test_collect_rejects_patient_mismatch(fake_db):
    """The core protection: a tampered patient_id must not attach to someone else."""
    phlebo, real_patient, other_patient = (str(uuid.uuid4()) for _ in range(3))
    _seed_phlebo(fake_db, phlebo, 150)
    run = _seed_dispatch(fake_db, phlebo, real_patient)

    res = await SampleService.collect(
        phlebotomist_user_id=phlebo,
        patient_id=other_patient,          # not the patient on the run
        dispatch_request_id=run,
    )
    assert not res["success"]
    assert "does not match that run" in res["message"]
    assert fake_db.db.get("samples", []) == []


@pytest.mark.asyncio
async def test_collect_derives_patient_from_run(fake_db):
    """With no patient_id supplied, the run's patient is used."""
    phlebo, patient = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, 150)
    run = _seed_dispatch(fake_db, phlebo, patient)

    res = await SampleService.collect(
        phlebotomist_user_id=phlebo, dispatch_request_id=run, barcode="CMX-DERIVE"
    )
    assert res["success"]
    stored = next(s for s in fake_db.db["samples"] if s["barcode"] == "CMX-DERIVE")
    assert stored["patient_id"] == patient


@pytest.mark.asyncio
async def test_admin_may_file_an_unlinked_sample(fake_db):
    """Back-office corrections and walk-ins still need a way through."""
    admin, patient = str(uuid.uuid4()), str(uuid.uuid4())
    res = await SampleService.collect(
        phlebotomist_user_id=admin, patient_id=patient,
        barcode="CMX-ADMIN", allow_unlinked=True,
    )
    assert res["success"]


# ── Handover + payout ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_partial_acceptance_pays_only_accepted_tubes(fake_db):
    phlebo, patient, lab = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, 150, home_lab=lab)
    _seed_org(fake_db, lab, "Vizag Diagnostics")

    good = await _collect(fake_db, phlebo, patient, barcode="CMX-A")
    bad = await _collect(fake_db, phlebo, patient, barcode="CMX-B")

    handover = await SampleService.request_handover(
        phlebo, [good["sample_id"], bad["sample_id"]]
    )
    assert handover["success"] and handover["submitted_count"] == 2
    assert handover["destination_name"] == "Vizag Diagnostics"

    result = await SampleService.respond_to_handover(
        handover_id=handover["handover_id"],
        responder_user_id=lab,
        accepted_sample_ids=[good["sample_id"]],
        rejected={bad["sample_id"]: "Haemolysed on arrival"},
    )

    assert result["success"]
    assert result["status"] == "partially_accepted"
    assert result["accepted_count"] == 1 and result["rejected_count"] == 1
    # Only the accepted tube is paid: 1 x Rs150.
    assert result["payout"]["amount"] == 150.0
    assert WalletService.recompute_balance(phlebo) == 150.0

    samples = {s["barcode"]: s for s in fake_db.db["samples"]}
    assert samples["CMX-A"]["status"] == "received"
    assert samples["CMX-B"]["status"] == "rejected"
    assert samples["CMX-B"]["rejection_reason"] == "Haemolysed on arrival"


@pytest.mark.asyncio
async def test_full_time_phlebotomist_accrues_no_per_collection_credit(fake_db):
    phlebo, patient, lab = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, 0, phleb_type="full_time", home_lab=lab)
    _seed_org(fake_db, lab, "KIMS Lab")

    s = await _collect(fake_db, phlebo, patient, barcode="CMX-FT")
    h = await SampleService.request_handover(phlebo, [s["sample_id"]])
    result = await SampleService.respond_to_handover(h["handover_id"], lab, [s["sample_id"]])

    assert result["success"] and result["accepted_count"] == 1
    assert result["payout"]["amount"] == 0.0
    assert "Salaried" in result["payout"]["note"]
    assert WalletService.recompute_balance(phlebo) == 0.0


@pytest.mark.asyncio
async def test_handover_rejected_by_wrong_centre(fake_db):
    phlebo, patient, lab, other = (str(uuid.uuid4()) for _ in range(4))
    _seed_phlebo(fake_db, phlebo, 150, home_lab=lab)

    s = await _collect(fake_db, phlebo, patient, barcode="CMX-SEC")
    h = await SampleService.request_handover(phlebo, [s["sample_id"]])

    result = await SampleService.respond_to_handover(h["handover_id"], other, [s["sample_id"]])
    assert not result["success"]
    assert "not sent to your centre" in result["message"]


@pytest.mark.asyncio
async def test_handover_cannot_be_answered_twice(fake_db):
    phlebo, patient, lab = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, 150, home_lab=lab)

    s = await _collect(fake_db, phlebo, patient, barcode="CMX-ONCE")
    h = await SampleService.request_handover(phlebo, [s["sample_id"]])

    first = await SampleService.respond_to_handover(h["handover_id"], lab, [s["sample_id"]])
    second = await SampleService.respond_to_handover(h["handover_id"], lab, [s["sample_id"]])

    assert first["success"]
    assert not second["success"] and "already" in second["message"]
    # And the phlebotomist was paid exactly once.
    assert WalletService.recompute_balance(phlebo) == 150.0


@pytest.mark.asyncio
async def test_unaddressed_tubes_default_to_accepted(fake_db):
    """A centre that rules on one tube implicitly accepts the rest of the batch."""
    phlebo, patient, lab = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, 150, home_lab=lab)

    a = await _collect(fake_db, phlebo, patient, barcode="CMX-U1")
    b = await _collect(fake_db, phlebo, patient, barcode="CMX-U2")
    h = await SampleService.request_handover(phlebo, [a["sample_id"], b["sample_id"]])

    result = await SampleService.respond_to_handover(
        h["handover_id"], lab, accepted_sample_ids=[a["sample_id"]]
    )
    assert result["accepted_count"] == 2
    assert result["status"] == "accepted"


@pytest.mark.asyncio
async def test_handover_requires_a_destination(fake_db):
    phlebo, patient = str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, 150, home_lab=None)

    s = await _collect(fake_db, phlebo, patient, barcode="CMX-NODEST")
    result = await SampleService.request_handover(phlebo, [s["sample_id"]])
    assert not result["success"]
    assert "No destination diagnostic centre" in result["message"]


@pytest.mark.asyncio
async def test_cannot_hand_over_another_phlebotomists_sample(fake_db):
    mine, theirs, patient, lab = (str(uuid.uuid4()) for _ in range(4))
    _seed_phlebo(fake_db, mine, 150, home_lab=lab)
    _seed_phlebo(fake_db, theirs, 150, home_lab=lab)

    s = await _collect(fake_db, theirs, patient, barcode="CMX-OTHER")
    result = await SampleService.request_handover(mine, [s["sample_id"]])
    assert not result["success"]


# ── Report ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_report_publishes_only_after_receipt(fake_db):
    phlebo, patient, lab = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, 150, home_lab=lab)

    s = await _collect(fake_db, phlebo, patient, barcode="CMX-REP")

    early = await SampleService.upload_report(s["sample_id"], lab, "http://x/r.pdf")
    assert not early["success"], "must not publish a report before the lab receives the tube"

    h = await SampleService.request_handover(phlebo, [s["sample_id"]])
    await SampleService.respond_to_handover(h["handover_id"], lab, [s["sample_id"]])

    ok = await SampleService.upload_report(s["sample_id"], lab, "http://x/r.pdf")
    assert ok["success"]

    stored = next(x for x in fake_db.db["samples"] if x["barcode"] == "CMX-REP")
    assert stored["status"] == "report_ready"
    assert stored["report_url"] == "http://x/r.pdf"


@pytest.mark.asyncio
async def test_custody_trail_is_ordered_and_complete(fake_db):
    phlebo, patient, lab = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    _seed_phlebo(fake_db, phlebo, 150, home_lab=lab)
    _seed_org(fake_db, lab, "Apollo Diagnostics")

    s = await _collect(fake_db, phlebo, patient, barcode="CMX-TRAIL")
    h = await SampleService.request_handover(phlebo, [s["sample_id"]])
    await SampleService.respond_to_handover(h["handover_id"], lab, [s["sample_id"]])
    await SampleService.upload_report(s["sample_id"], lab, "http://x/r.pdf")

    trail = SampleService.get_custody_trail(s["sample_id"])
    assert [e["event"] for e in trail["events"]] == [
        "collected", "handover_requested", "received", "report_uploaded",
    ]
    assert trail["destination_name"] == "Apollo Diagnostics"
