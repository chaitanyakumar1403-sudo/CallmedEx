"""
Urgent dispatch tests.

Three invariants:

  1. Urgent widens the net (bigger radius, more parallel offers) but never
     shortens a provider's accept window, which is a contractual MOU term.
  2. The accept window is the MOU's 10 minutes, and it is ENFORCED — expires_at
     was previously written on every offer and checked by nothing.
  3. Only genuinely urgent work gets urgent alerting, so the word keeps meaning
     something.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

import app.services.dispatch_engine as engine_mod
from app.services.dispatch_engine import (
    DEFAULT_OFFER_WINDOW_MINUTES,
    NORMAL_MAX_OFFERS,
    URGENT_MAX_OFFERS,
    URGENT_RADIUS_MULTIPLIER,
    UniversalDispatchEngine,
    offer_window_minutes,
)
from app.services.email import EmailService

from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(engine_mod, "supabase", fake)
    # Never send real mail from a test.
    monkeypatch.setattr(engine_mod.EmailService, "send_magic_dispatch_email",
                        staticmethod(lambda **kw: None))
    return fake


def _seed_provider(fake, lat, lng, ptype="nurse", name="Nurse",
                   verification_status="verified"):
    uid = str(uuid.uuid4())
    fake.db.setdefault("provider_locations", []).append({
        "user_id": uid, "provider_type": ptype, "is_online": True,
        "current_lat": lat, "current_lng": lng,
        "users": {"id": uid, "full_name": name, "mobile": "9000000000",
                  "email": f"{uid[:8]}@test.local",
                  "verification_status": verification_status},
    })
    return uid


def _seed_window(fake, minutes):
    fake.db.setdefault("platform_settings", []).append({
        "key": "phlebo_offer_window_minutes", "value": {"minutes": minutes},
    })


# ── Accept window ────────────────────────────────────────────────────────────

def test_default_window_matches_the_mou(fake_db):
    """The MOUs say 10 minutes; the old code said 30 seconds."""
    assert DEFAULT_OFFER_WINDOW_MINUTES == 10
    assert offer_window_minutes() == 10


def test_window_is_configurable(fake_db):
    _seed_window(fake_db, 15)
    assert offer_window_minutes() == 15


@pytest.mark.parametrize("bad", [{"minutes": 0}, {"minutes": -5}, {}, {"minutes": "ten"}])
def test_malformed_window_falls_back_to_the_mou(fake_db, bad):
    fake_db.db.setdefault("platform_settings", []).append(
        {"key": "phlebo_offer_window_minutes", "value": bad}
    )
    assert offer_window_minutes() == DEFAULT_OFFER_WINDOW_MINUTES


# ── Urgent widens rather than rushes ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_urgent_widens_radius_without_shortening_the_window(fake_db):
    patient = (17.70, 83.30)
    near = _seed_provider(fake_db, 17.71, 83.31)          # ~1.4 km
    far = _seed_provider(fake_db, 17.82, 83.42)           # ~16 km

    normal = await UniversalDispatchEngine.create_dispatch(
        patient_id=str(uuid.uuid4()), patient_lat=patient[0], patient_lng=patient[1],
        patient_address="Test", provider_type="nurse", search_radius_km=10.0,
    )
    urgent = await UniversalDispatchEngine.create_dispatch(
        patient_id=str(uuid.uuid4()), patient_lat=patient[0], patient_lng=patient[1],
        patient_address="Test", provider_type="nurse", search_radius_km=10.0,
        priority="urgent",
    )

    assert normal["all_candidates"] == 1          # only the near provider
    assert urgent["all_candidates"] == 2          # doubled radius reaches the far one
    assert urgent["priority"] == "urgent"

    # Critically: the accept window is identical. Urgency must not erode a
    # contractual term.
    offers = fake_db.db["dispatch_offers"]
    windows = set()
    for o in offers:
        delta = datetime.fromisoformat(o["expires_at"]) - datetime.fromisoformat(o["offered_at"])
        windows.add(round(delta.total_seconds() / 60))
    assert windows == {DEFAULT_OFFER_WINDOW_MINUTES}
    assert near and far  # both seeded providers were used


@pytest.mark.asyncio
async def test_urgent_notifies_more_providers_in_parallel(fake_db):
    for i in range(15):
        _seed_provider(fake_db, 17.70 + i * 0.001, 83.30, name=f"Nurse {i}")

    normal = await UniversalDispatchEngine.create_dispatch(
        patient_id=str(uuid.uuid4()), patient_lat=17.70, patient_lng=83.30,
        patient_address="T", provider_type="nurse",
    )
    assert normal["all_candidates"] == NORMAL_MAX_OFFERS

    fake_db.db["dispatch_offers"] = []
    urgent = await UniversalDispatchEngine.create_dispatch(
        patient_id=str(uuid.uuid4()), patient_lat=17.70, patient_lng=83.30,
        patient_address="T", provider_type="nurse", priority="urgent",
    )
    assert urgent["all_candidates"] == URGENT_MAX_OFFERS
    assert URGENT_MAX_OFFERS > NORMAL_MAX_OFFERS


@pytest.mark.asyncio
async def test_priority_is_persisted_on_the_request(fake_db):
    _seed_provider(fake_db, 17.70, 83.30)
    await UniversalDispatchEngine.create_dispatch(
        patient_id=str(uuid.uuid4()), patient_lat=17.70, patient_lng=83.30,
        patient_address="T", provider_type="nurse", priority="urgent",
    )
    row = fake_db.db["dispatch_requests"][0]
    assert row["priority"] == "urgent"
    # The widened radius is recorded, not the requested one, so operations can
    # see how far the net was actually cast.
    assert row["search_radius_km"] == 10.0 * URGENT_RADIUS_MULTIPLIER


@pytest.mark.asyncio
async def test_normal_priority_is_the_default(fake_db):
    _seed_provider(fake_db, 17.70, 83.30)
    result = await UniversalDispatchEngine.create_dispatch(
        patient_id=str(uuid.uuid4()), patient_lat=17.70, patient_lng=83.30,
        patient_address="T", provider_type="nurse",
    )
    assert result["priority"] == "normal"
    assert fake_db.db["dispatch_requests"][0]["priority"] == "normal"


# ── Expiry enforcement ───────────────────────────────────────────────────────

def _seed_offer(fake, provider_id, expires_at, status="pending"):
    oid, did = str(uuid.uuid4()), str(uuid.uuid4())
    fake.db.setdefault("dispatch_requests", []).append({
        "id": did, "status": "provider_notified", "priority": "normal",
    })
    fake.db.setdefault("dispatch_offers", []).append({
        "id": oid, "dispatch_request_id": did, "provider_id": provider_id,
        "status": status, "expires_at": expires_at,
        "offered_at": datetime.now(timezone.utc).isoformat(),
    })
    return oid


@pytest.mark.asyncio
async def test_expired_offer_cannot_be_accepted(fake_db):
    """Previously expires_at was written and never checked."""
    provider = str(uuid.uuid4())
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    oid = _seed_offer(fake_db, provider, past)

    result = await UniversalDispatchEngine.respond_to_offer(oid, provider, accepted=True)

    assert not result["success"]
    assert "expired" in result["message"].lower()
    offer = next(o for o in fake_db.db["dispatch_offers"] if o["id"] == oid)
    assert offer["status"] == "expired"


@pytest.mark.asyncio
async def test_live_offer_can_still_be_accepted(fake_db):
    provider = str(uuid.uuid4())
    future = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    oid = _seed_offer(fake_db, provider, future)

    result = await UniversalDispatchEngine.respond_to_offer(oid, provider, accepted=True)
    assert result["success"]


@pytest.mark.asyncio
async def test_already_answered_offer_is_rejected(fake_db):
    provider = str(uuid.uuid4())
    future = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    oid = _seed_offer(fake_db, provider, future, status="accepted")

    result = await UniversalDispatchEngine.respond_to_offer(oid, provider, accepted=True)
    assert not result["success"]
    assert "already" in result["message"].lower()


@pytest.mark.asyncio
async def test_unparseable_expiry_does_not_block_a_provider(fake_db):
    """A bad timestamp is our bug; the provider should not pay for it."""
    provider = str(uuid.uuid4())
    oid = _seed_offer(fake_db, provider, "not-a-timestamp")

    result = await UniversalDispatchEngine.respond_to_offer(oid, provider, accepted=True)
    assert result["success"]


# ── Alerting ─────────────────────────────────────────────────────────────────

def test_only_urgent_work_gets_urgent_subject(monkeypatch):
    """Every dispatch email used to say "🚨 Urgent", which trains people to ignore it."""
    captured = {}

    def capture(to_email, subject, html_content, text_content):
        captured["subject"] = subject
        captured["html"] = html_content
        return True

    monkeypatch.setattr(EmailService, "_send_real_email", staticmethod(capture))

    EmailService.send_magic_dispatch_email(
        to_email="n@test.local", provider_name="Nurse",
        task_details={"service_subtype": "wound_dressing", "distance_km": 2,
                      "priority": "normal", "window_minutes": 10},
        offer_id=str(uuid.uuid4()), provider_id=str(uuid.uuid4()),
    )
    assert "URGENT" not in captured["subject"]
    assert "PRIORITY DISPATCH" not in captured["html"]

    EmailService.send_magic_dispatch_email(
        to_email="n@test.local", provider_name="Nurse",
        task_details={"service_subtype": "wound_dressing", "distance_km": 2,
                      "priority": "urgent", "window_minutes": 10},
        offer_id=str(uuid.uuid4()), provider_id=str(uuid.uuid4()),
    )
    assert "URGENT" in captured["subject"]
    assert "PRIORITY DISPATCH" in captured["html"]


def test_email_states_the_real_window(monkeypatch):
    """The body claimed a flat 5 minutes regardless of the actual window."""
    captured = {}
    monkeypatch.setattr(
        EmailService, "_send_real_email",
        staticmethod(lambda to_email, subject, html_content, text_content:
                     captured.update(html=html_content, text=text_content) or True),
    )

    EmailService.send_magic_dispatch_email(
        to_email="n@test.local", provider_name="Nurse",
        task_details={"service_subtype": "injection", "distance_km": 1,
                      "priority": "normal", "window_minutes": 10},
        offer_id=str(uuid.uuid4()), provider_id=str(uuid.uuid4()),
    )
    assert "10 minutes" in captured["html"]
    assert "5 minutes" not in captured["html"]


# ── Centre-bound home collection ─────────────────────────────────────────────

def _seed_phlebo_at_centre(fake, lat, lng, centre_id, name="Phlebo"):
    uid = _seed_provider(fake, lat, lng, ptype="phlebotomist", name=name)
    fake.db.setdefault("phlebotomists", []).append({
        "user_id": uid, "processing_center_id": centre_id,
        "base_lat": lat, "base_lng": lng,
    })
    return uid


@pytest.mark.asyncio
async def test_a_phlebo_of_another_centre_is_never_a_candidate(fake_db):
    """They could not submit the tube afterwards, however close they are."""
    mine, theirs = "centre-a", "centre-b"
    _seed_phlebo_at_centre(fake_db, 17.3850, 78.4870, theirs, "Wrong centre")
    ours = _seed_phlebo_at_centre(fake_db, 17.3900, 78.4900, mine, "Right centre")

    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist", processing_center_id=mine)
    assert [c["user_id"] for c in found] == [ours]


@pytest.mark.asyncio
async def test_urgent_ignores_the_distance_cap_within_the_centre(fake_db):
    centre = "centre-a"
    far = _seed_phlebo_at_centre(fake_db, 17.9000, 78.9000, centre, "Far but ours")

    normal = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist", processing_center_id=centre)
    urgent = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist",
        processing_center_id=centre, ignore_radius=True)

    assert [c["user_id"] for c in normal] == []
    assert [c["user_id"] for c in urgent] == [far]


@pytest.mark.asyncio
async def test_urgent_still_never_crosses_a_centre_boundary(fake_db):
    """'All of them' is centre-scoped: a Hyderabad phlebo cannot serve Vizag."""
    _seed_phlebo_at_centre(fake_db, 17.3850, 78.4870, "centre-b", "Other centre")
    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist",
        processing_center_id="centre-a", ignore_radius=True)
    assert found == []


@pytest.mark.asyncio
async def test_the_centre_filter_is_opt_in_so_other_provider_types_are_unaffected(fake_db):
    """Nurses, doctors and ambulances keep today's behaviour exactly."""
    uid = _seed_provider(fake_db, 17.3850, 78.4870, ptype="nurse", name="Nurse")
    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "nurse")
    assert [c["user_id"] for c in found] == [uid]


# ── Verification gate ──────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["pending", "flagged", "rejected", "", None])
async def test_an_unverified_provider_is_never_dispatched(fake_db, status):
    """provider_locations had no verification filter at all, so anyone who had
    a location row and flipped themselves online could be sent to a patient's
    home. Only 'verified' is dispatchable."""
    _seed_provider(fake_db, 17.3850, 78.4870, ptype="nurse",
                   verification_status=status)
    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "nurse")
    assert found == []


@pytest.mark.asyncio
async def test_a_verified_provider_is_still_dispatched(fake_db):
    uid = _seed_provider(fake_db, 17.3850, 78.4870, ptype="nurse",
                         verification_status="verified")
    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "nurse")
    assert [c["user_id"] for c in found] == [uid]


# ── Uncapped urgent centre-wide fan-out (Finding 1, review round 1) ─────────

@pytest.mark.asyncio
async def test_urgent_home_collection_notifies_every_phlebo_not_just_the_cap(fake_db):
    """A surge with >URGENT_MAX_OFFERS on-duty phlebos must reach ALL of them.

    All 15 are seeded well beyond the default 10 km radius, so only the
    centre-wide, radius-ignoring, uncapped fan-out finds them.
    """
    centre = "centre-a"
    ids = [
        _seed_phlebo_at_centre(fake_db, 17.90 + i * 0.01, 78.90 + i * 0.01,
                                centre, f"Phlebo {i}")
        for i in range(15)
    ]
    assert len(ids) > URGENT_MAX_OFFERS

    result = await UniversalDispatchEngine.create_dispatch(
        patient_id=str(uuid.uuid4()), patient_lat=17.3851, patient_lng=78.4871,
        patient_address="Test", provider_type="phlebotomist",
        search_radius_km=10.0, processing_center_id=centre, priority="urgent",
    )

    assert result["all_candidates"] == 15


# ── create_dispatch wiring coverage (Finding 2, review round 1) ─────────────

@pytest.mark.asyncio
async def test_create_dispatch_urgent_home_collection_uses_centre_fanout_not_the_multiplier(fake_db):
    """The wiring, not just the primitive: urgent phlebo + centre must ignore
    radius and leave search_radius_km unmultiplied, reaching a phlebo far
    beyond even the doubled radius.
    """
    centre = "centre-a"
    # ~70 km away — well past both the 10 km base radius and the 20 km
    # doubled radius, so only ignore_radius=True can find it.
    far = _seed_phlebo_at_centre(fake_db, 17.9000, 78.9000, centre, "Far but ours")

    result = await UniversalDispatchEngine.create_dispatch(
        patient_id=str(uuid.uuid4()), patient_lat=17.3851, patient_lng=78.4871,
        patient_address="Test", provider_type="phlebotomist",
        search_radius_km=10.0, processing_center_id=centre, priority="urgent",
    )

    assert result["all_candidates"] == 1
    row = fake_db.db["dispatch_requests"][-1]
    # Not doubled: the centre-wide fan-out relies on ignoring the radius cap
    # entirely, not on a bigger radius.
    assert row["search_radius_km"] == 10.0
    assert far  # the seeded far phlebo is the one that had to be reached


# ── Orphaned booking_id recovery (production incident, Aug 2026) ────────────

class _OrphanedBookingFake(FakeSupabase):
    """Rejects the first dispatch_requests insert if it references a
    booking_id that was never actually persisted to `bookings` — reproducing
    the dispatch_requests_booking_id_fkey violation that used to silently
    drop the whole dispatch (and every phlebo notification with it) whenever
    the frontend's "on_demand" provider_id sentinel failed the bookings
    insert.
    """
    def table(self, name):
        q = super().table(name)
        if name == "dispatch_requests":
            orig_execute = q.execute

            def execute():
                if q._op == "insert":
                    records = q._payload if isinstance(q._payload, list) else [q._payload]
                    for rec in records:
                        bid = rec.get("booking_id")
                        if bid and not any(b.get("id") == bid for b in self.db.get("bookings", [])):
                            raise Exception(
                                'insert or update on table "dispatch_requests" violates '
                                'foreign key constraint "dispatch_requests_booking_id_fkey"'
                            )
                return orig_execute()

            q.execute = execute
        return q


@pytest.mark.asyncio
async def test_create_dispatch_recovers_from_an_orphaned_booking_id(monkeypatch):
    """The bug: a dead booking_id used to kill the ENTIRE dispatch, so no
    phlebo was ever notified. The fix: retry the insert without the link.
    """
    fake = _OrphanedBookingFake()
    monkeypatch.setattr(engine_mod, "supabase", fake)
    monkeypatch.setattr(engine_mod.EmailService, "send_magic_dispatch_email",
                         staticmethod(lambda **kw: None))
    _seed_provider(fake, 17.70, 83.30)
    orphan_booking_id = str(uuid.uuid4())  # never inserted into "bookings"

    result = await UniversalDispatchEngine.create_dispatch(
        patient_id=str(uuid.uuid4()), patient_lat=17.70, patient_lng=83.30,
        patient_address="T", provider_type="nurse", booking_id=orphan_booking_id,
    )

    assert result["all_candidates"] == 1
    assert fake.db["dispatch_requests"][0]["booking_id"] is None
    assert fake.db["dispatch_offers"]  # the phlebo still got an offer/notification


@pytest.mark.asyncio
async def test_create_dispatch_urgent_nurse_still_uses_the_radius_multiplier(fake_db):
    """Negative case: non-home-collection urgent dispatch is untouched."""
    near = _seed_provider(fake_db, 17.71, 83.31, name="Near nurse")   # ~1.4 km
    far = _seed_provider(fake_db, 17.82, 83.42, name="Far nurse")     # ~16 km

    result = await UniversalDispatchEngine.create_dispatch(
        patient_id=str(uuid.uuid4()), patient_lat=17.70, patient_lng=83.30,
        patient_address="Test", provider_type="nurse",
        search_radius_km=10.0, priority="urgent",
    )

    assert result["all_candidates"] == 2  # doubled radius reaches the far one
    row = fake_db.db["dispatch_requests"][-1]
    assert row["search_radius_km"] == 10.0 * URGENT_RADIUS_MULTIPLIER
    assert near and far
