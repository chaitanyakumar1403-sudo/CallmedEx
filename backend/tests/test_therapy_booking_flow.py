"""
Physiotherapy / dietetics: the three ways a patient can book, end to end.

Pins the gaps that made the whole offering non-functional:

  1. provider_scope read current_user["id"], but the JWT carries "sub" — every
     scope read and write 500'd, so no therapist could ever set a fee or a
     service.
  2. Availability and fees were gated to role == "doctor", so a physiotherapist
     could not publish a single bookable slot.
  3. The slot generator compared IST slot times against the server's UTC clock
     and offered appointments hours in the past.
  4. Walk-in and teleconsult slots came back mixed, so a walk-in booking could
     be made against an online-only block.
  5. A home visit booked against a named therapist raised no dispatch at all —
     the booking was written CONFIRMED and nobody was ever told.
"""
from datetime import datetime, timedelta, timezone

import pytest


IST = timezone(timedelta(hours=5, minutes=30))


# ── 1. JWT claim key ───────────────────────────────────────────────────────

def test_provider_scope_reads_the_claim_the_token_actually_carries():
    """create_access_token writes sub/email/role/name — never "id"."""
    import inspect
    import app.routers.provider_scope as ps

    source = inspect.getsource(ps)
    assert 'current_user["id"]' not in source, (
        'provider_scope must read current_user["sub"]; the JWT has no "id" claim '
        "and this raised KeyError -> 500 on every scope read and write."
    )
    assert 'current_user["sub"]' in source


# ── 2. Who may publish a schedule ─────────────────────────────────────────

def test_therapists_may_publish_availability_and_fees():
    from app.routers.provider_management import SCHEDULING_PROVIDER_ROLES

    for role in ("physiotherapist", "dietitian", "nurse", "doctor"):
        assert role in SCHEDULING_PROVIDER_ROLES, f"{role} cannot publish slots"
    # Patients and organizations must not be able to.
    assert "patient" not in SCHEDULING_PROVIDER_ROLES
    assert "organization" not in SCHEDULING_PROVIDER_ROLES


def test_dispatchable_provider_types_cover_home_visit_therapists():
    from app.services.dispatch_engine import VALID_PROVIDER_TYPES

    # Both are sold with a home_visit_fee, so both must be dispatchable.
    assert "physiotherapist" in VALID_PROVIDER_TYPES
    assert "dietitian" in VALID_PROVIDER_TYPES


# ── 3/4. Slot generation ──────────────────────────────────────────────────

def _availability(mode, start, end, day_of_week, location=""):
    return {
        "id": f"av-{mode}-{start}",
        "doctor_id": "usr-pt-1",
        "day_of_week": day_of_week,
        "start_time": start,
        "end_time": end,
        "slot_duration_minutes": 30,
        "consultation_mode": mode,
        "max_patients_per_slot": 1,
        "location_name": location,
        "location_address": "12 Beach Road, Visakhapatnam" if location else "",
        "is_active": True,
    }


class _SlotDB:
    """Minimal Supabase stand-in for the slot generator."""

    def __init__(self, availability, booked=()):
        self.availability = availability
        self.booked = list(booked)
        self._table = None
        self._filters = {}

    def table(self, name):
        self._table = name
        self._filters = {}
        return self

    def select(self, *a, **k):
        return self

    def eq(self, col, val):
        self._filters[col] = val
        return self

    def neq(self, *a, **k):
        return self

    def execute(self):
        class R:
            pass

        r = R()
        if self._table == "doctor_blocked_dates":
            r.data = []
        elif self._table == "doctor_availability":
            rows = [
                a for a in self.availability
                if a["day_of_week"] == self._filters.get("day_of_week")
            ]
            mode = self._filters.get("consultation_mode")
            if mode:
                rows = [a for a in rows if a["consultation_mode"] == mode]
            r.data = rows
        elif self._table == "bookings":
            r.data = [{"slot_time": t} for t in self.booked]
        else:
            r.data = []
        return r


async def _slots(db, target_date, monkeypatch, mode=None):
    import app.routers.provider_management as pm

    monkeypatch.setattr(pm, "supabase", db)
    return await pm.get_available_slots(
        provider_id="usr-pt-1",
        target_date=target_date,
        mode=mode,
        current_user={"sub": "pat-1", "role": "patient"},
    )


@pytest.mark.asyncio
async def test_walkin_and_online_slots_do_not_bleed_into_each_other(monkeypatch):
    """A physiotherapist publishes clinic hours AND teleconsult hours. Booking a
    walk-in must never be offered an online-only slot."""
    target = (datetime.now(IST) + timedelta(days=3)).date()
    dow = (target.weekday() + 1) % 7  # python Mon=0 -> schema Sun=0

    db = _SlotDB([
        _availability("in_person", "09:00", "11:00", dow, location="Gajuwaka Physio Centre"),
        _availability("online", "18:00", "19:00", dow),
    ])

    walkin = await _slots(db, target.isoformat(), monkeypatch, mode="in_person")
    assert walkin["slots"], "walk-in slots missing"
    assert {s["consultation_mode"] for s in walkin["slots"]} == {"in_person"}
    assert all(s["location"] == "Gajuwaka Physio Centre" for s in walkin["slots"])
    assert all(s["location_address"] for s in walkin["slots"])

    online = await _slots(db, target.isoformat(), monkeypatch, mode="online")
    assert {s["consultation_mode"] for s in online["slots"]} == {"online"}

    both = await _slots(db, target.isoformat(), monkeypatch)
    assert {s["consultation_mode"] for s in both["slots"]} == {"in_person", "online"}


@pytest.mark.asyncio
async def test_a_booked_slot_is_marked_unavailable(monkeypatch):
    target = (datetime.now(IST) + timedelta(days=3)).date()
    dow = (target.weekday() + 1) % 7

    db = _SlotDB(
        [_availability("in_person", "09:00", "10:00", dow, location="Centre")],
        booked=["09:30"],
    )
    out = await _slots(db, target.isoformat(), monkeypatch, mode="in_person")
    by_time = {s["time"]: s for s in out["slots"]}
    assert by_time["09:00"]["is_available"] is True
    assert by_time["09:30"]["is_available"] is False


@pytest.mark.asyncio
async def test_todays_past_slots_are_dropped_in_ist_not_server_time(monkeypatch):
    """The old code compared IST slot times against datetime.now() — UTC in
    production — and so offered appointments five hours in the past."""
    now_ist = datetime.now(IST)
    target = now_ist.date()
    dow = (target.weekday() + 1) % 7

    # A block spanning the whole day, so what survives is purely the cutoff.
    db = _SlotDB([_availability("online", "00:00", "23:30", dow)])
    out = await _slots(db, target.isoformat(), monkeypatch, mode="online")

    cutoff = now_ist.strftime("%H:%M")
    for s in out["slots"]:
        assert s["time"] > cutoff, f"slot {s['time']} is already past (IST now {cutoff})"


@pytest.mark.asyncio
async def test_slot_display_does_not_use_a_glibc_only_format(monkeypatch):
    """%-I raises ValueError on Windows, taking the whole endpoint down."""
    target = (datetime.now(IST) + timedelta(days=2)).date()
    dow = (target.weekday() + 1) % 7
    db = _SlotDB([_availability("online", "09:00", "10:00", dow)])
    out = await _slots(db, target.isoformat(), monkeypatch, mode="online")
    assert out["slots"][0]["display"] == "9:00 AM"


# ── 5. Home visit raises a dispatch to the chosen therapist ───────────────

@pytest.mark.asyncio
async def test_home_visit_offers_the_job_to_the_named_therapist(monkeypatch):
    """create_dispatch fans out by proximity, which is wrong when the patient
    picked this therapist and is paying their rate. Exactly one offer, to them."""
    import app.services.dispatch_engine as engine

    inserted = {"dispatch": None, "offer": None}

    class _T:
        def __init__(self, name):
            self.name = name

        def insert(self, payload):
            inserted[self.name] = payload
            return self

        def select(self, *a, **k):
            return self

        def eq(self, *a, **k):
            return self

        def limit(self, *a, **k):
            return self

        def execute(self):
            class R:
                data = [{"full_name": "Test Physio", "email": "pt@example.test"}]
            return R()

    class _DB:
        def table(self, name):
            return _T("dispatch" if name == "dispatch_requests"
                      else "offer" if name == "dispatch_offers" else name)

    monkeypatch.setattr(engine, "supabase", _DB())
    monkeypatch.setattr(
        engine.EmailService, "send_magic_dispatch_email_safe",
        staticmethod(lambda **kw: None),
    )

    out = await engine.UniversalDispatchEngine.create_direct_dispatch(
        patient_id="11111111-1111-1111-1111-111111111111",
        provider_id="22222222-2222-2222-2222-222222222222",
        provider_type="physiotherapist",
        patient_lat=17.7,
        patient_lng=83.3,
        patient_address="12 MG Road, Visakhapatnam",
        booking_id="33333333-3333-3333-3333-333333333333",
        service_subtype="physiotherapy",
    )

    assert out["success"] is True
    d = inserted["dispatch"]
    assert d["provider_type"] == "physiotherapist"
    # Notified, NOT auto-accepted: the therapist still has to take the job.
    assert d["status"] == "provider_notified"
    assert d["assigned_provider_id"] is None
    assert d["patient_lat"] == 17.7

    o = inserted["offer"]
    assert o["provider_id"] == "22222222-2222-2222-2222-222222222222"
    assert o["status"] == "pending"
    assert o["expires_at"] > o["offered_at"]


@pytest.mark.asyncio
async def test_direct_dispatch_reports_failure_instead_of_claiming_success(monkeypatch):
    """A patient must never be told a therapist is coming when no dispatch row
    was written."""
    import app.services.dispatch_engine as engine

    class _Boom:
        def table(self, _name):
            raise RuntimeError("db down")

    monkeypatch.setattr(engine, "supabase", _Boom())

    out = await engine.UniversalDispatchEngine.create_direct_dispatch(
        patient_id="11111111-1111-1111-1111-111111111111",
        provider_id="22222222-2222-2222-2222-222222222222",
        provider_type="physiotherapist",
        patient_lat=17.7,
        patient_lng=83.3,
        patient_address="12 MG Road",
    )
    assert out["success"] is False


def test_offer_push_copy_survives_a_missing_distance():
    """A direct offer has no distance — the push body used to read
    "None km away" and called every visit a "collection"."""
    import inspect
    from app.services.dispatch_engine import UniversalDispatchEngine as E

    src = inspect.getsource(E._push_offer_to_candidate)
    assert "distance_km is not None" in src
    assert "New collection request" not in src


@pytest.mark.asyncio
async def test_get_optional_current_user_returns_none_when_unauthenticated():
    from app.middleware.auth import get_optional_current_user

    user = await get_optional_current_user(credentials=None)
    assert user is None


@pytest.mark.asyncio
async def test_get_optional_current_user_returns_payload_when_token_valid():
    from app.middleware.auth import get_optional_current_user
    from app.utils.security import create_access_token
    from fastapi.security import HTTPAuthorizationCredentials

    token = create_access_token(data={"sub": "test-patient-id", "email": "patient@example.com", "role": "patient"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user = await get_optional_current_user(credentials=creds)

    assert user is not None
    assert user["sub"] == "test-patient-id"
    assert user["role"] == "patient"


def test_slots_endpoint_uses_optional_auth_dependency():
    """Slots endpoint must use get_optional_current_user so patients can discover slots without logging in."""
    import inspect
    from app.routers.provider_management import get_available_slots
    from app.middleware.auth import get_optional_current_user

    sig = inspect.signature(get_available_slots)
    assert "current_user" in sig.parameters
    default_val = sig.parameters["current_user"].default
    assert hasattr(default_val, "dependency")
    assert default_val.dependency == get_optional_current_user

