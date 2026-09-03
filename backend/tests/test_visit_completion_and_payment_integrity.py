"""
Four ways a completed booking used to end in the wrong place.

  1. /payments/create-order billed whatever rupee figure the caller put in the
     request body. A 4,000 rupee collection could be settled with 1 rupee, and
     verify_payment confirmed it — its signature and amount checks both compare
     against that same client-supplied number, so nothing downstream caught it.
     Nor was the booking ever checked to belong to the caller.
  2. update_status reported success when it had matched no row, so /status,
     /verify-otp and /magic-status all told a provider the visit had moved on
     while the row sat untouched.
  3. verify_otp spends the patient's arrival code permanently, and in_progress
     is reachable no other way. A failure between the two stranded the visit:
     code used, row still `arrived`, `completed` refused for want of its
     prerequisite. Both call sites swallowed that failure and returned success.
  4. Re-fan-out ran only off the sweep, which looks for *pending* offers past
     expiry. A declined offer is not pending, so when every offered provider
     said no the request sat for the whole offer window and died as "no
     provider available" — with untried providers idle the entire time.
"""
import asyncio
import uuid

import pytest

import app.services.dispatch_engine as engine_mod
import app.services.otp as otp_mod
import app.services.payment as payment_mod
from app.services.dispatch_engine import UniversalDispatchEngine
from app.services.payment import PaymentService

from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    for mod in (engine_mod, otp_mod, payment_mod):
        monkeypatch.setattr(mod, "supabase", fake)
    return fake


# ── 1. The price is the server's to decide ───────────────────────────────────

def _seed_booking(fake, patient_id, total_price=None, tests=()):
    bid = str(uuid.uuid4())
    fake.db.setdefault("bookings", []).append({
        "id": bid, "patient_id": patient_id, "total_price": total_price,
        "final_amount": None, "status": "confirmed",
    })
    for price in tests:
        fake.db.setdefault("booking_tests", []).append({
            "booking_id": bid, "price_charged": price,
        })
    return bid


def test_amount_comes_from_the_server_priced_tests_not_the_booking_field(fake_db):
    """booking_tests.price_charged is written by the server from the catalog.

    bookings.total_price is the client's own number, so where both exist the
    priced rows win.
    """
    patient = str(uuid.uuid4())
    bid = _seed_booking(fake_db, patient, total_price=1, tests=(400.0, 3600.0))
    assert PaymentService.resolve_booking_amount(bid, patient) == 4000.0


def test_amount_falls_back_to_the_booking_total_when_nothing_is_priced(fake_db):
    """Consultations and home visits have no test rows; that record still counts."""
    patient = str(uuid.uuid4())
    bid = _seed_booking(fake_db, patient, total_price=750.0)
    assert PaymentService.resolve_booking_amount(bid, patient) == 750.0


def test_a_patient_cannot_open_an_order_against_another_patients_booking(fake_db):
    owner, intruder = str(uuid.uuid4()), str(uuid.uuid4())
    bid = _seed_booking(fake_db, owner, total_price=500.0)
    with pytest.raises(PermissionError):
        PaymentService.resolve_booking_amount(bid, intruder)


def test_a_missing_booking_is_not_payable(fake_db):
    with pytest.raises(LookupError):
        PaymentService.resolve_booking_amount(str(uuid.uuid4()), str(uuid.uuid4()))


def test_create_order_never_reads_the_amount_off_the_request():
    """The router must resolve the figure itself before charging anything."""
    import inspect
    import app.routers.payments as payments_router

    source = inspect.getsource(payments_router.create_order)
    assert "resolve_booking_amount" in source
    assert "amount=body.amount" not in source, (
        "create_order must charge the server's figure, never the caller's."
    )


# ── 2. A write that did not happen is not a success ──────────────────────────

def test_update_status_reports_failure_when_no_row_matched(fake_db):
    result = asyncio.run(
        UniversalDispatchEngine.update_status(
            dispatch_id=str(uuid.uuid4()), new_status="en_route",
        )
    )
    assert result["success"] is False


# ── 3. Arrival code and the transition it unlocks are one operation ──────────

def _seed_arrived_dispatch(fake, provider_id, status="arrived"):
    did = str(uuid.uuid4())
    fake.db.setdefault("dispatch_requests", []).append({
        "id": did, "patient_id": str(uuid.uuid4()),
        "assigned_provider_id": provider_id, "provider_type": "phlebotomist",
        "status": status, "booking_id": None,
    })
    return did


def test_otp_and_start_moves_the_visit_forward(fake_db):
    provider = str(uuid.uuid4())
    did = _seed_arrived_dispatch(fake_db, provider)
    otp = otp_mod.OTPService.generate_otp(did)

    result = asyncio.run(
        UniversalDispatchEngine.verify_otp_and_start(did, provider, otp)
    )
    assert result["success"] is True
    assert fake_db.db["dispatch_requests"][0]["status"] == "in_progress"


def test_an_interrupted_transition_can_be_retried(fake_db):
    """The code is spent on first use, so a retry must re-drive the transition.

    Refusing it as a replay left the visit at `arrived` with no route to
    `in_progress` and therefore none to `completed` — unfinishable.
    """
    provider = str(uuid.uuid4())
    did = _seed_arrived_dispatch(fake_db, provider)
    otp = otp_mod.OTPService.generate_otp(did)

    # First attempt: the code is consumed, the status write is lost.
    assert otp_mod.OTPService.verify_otp(did, otp)["success"] is True
    assert fake_db.db["dispatch_requests"][0]["status"] == "arrived"

    result = asyncio.run(
        UniversalDispatchEngine.verify_otp_and_start(did, provider, otp)
    )
    assert result["success"] is True
    assert fake_db.db["dispatch_requests"][0]["status"] == "in_progress"


def test_a_used_code_is_still_refused_once_the_visit_has_started(fake_db):
    """Only a stuck `arrived` earns the retry — anywhere else it is a replay."""
    provider = str(uuid.uuid4())
    did = _seed_arrived_dispatch(fake_db, provider)
    otp = otp_mod.OTPService.generate_otp(did)
    asyncio.run(UniversalDispatchEngine.verify_otp_and_start(did, provider, otp))

    again = asyncio.run(
        UniversalDispatchEngine.verify_otp_and_start(did, provider, otp)
    )
    assert again["success"] is False
    assert again["error"] == "OTP already verified"


def test_a_wrong_code_never_starts_the_visit(fake_db):
    provider = str(uuid.uuid4())
    did = _seed_arrived_dispatch(fake_db, provider)
    otp_mod.OTPService.generate_otp(did)

    result = asyncio.run(
        UniversalDispatchEngine.verify_otp_and_start(did, provider, "000000")
    )
    assert result["success"] is False
    assert fake_db.db["dispatch_requests"][0]["status"] == "arrived"


# ── 4. A decline keeps the request moving ────────────────────────────────────

def _seed_offer(fake, dispatch_id, provider_id, distance_km, status="pending"):
    oid = str(uuid.uuid4())
    fake.db.setdefault("dispatch_offers", []).append({
        "id": oid, "dispatch_request_id": dispatch_id, "provider_id": provider_id,
        "status": status, "distance_km": distance_km, "expires_at": None,
    })
    return oid


def _seed_open_dispatch(fake, provider_type="phlebotomist"):
    did = str(uuid.uuid4())
    fake.db.setdefault("dispatch_requests", []).append({
        "id": did, "patient_id": str(uuid.uuid4()), "provider_type": provider_type,
        "status": "provider_notified", "booking_id": None, "patient_lat": 17.7,
        "patient_lng": 83.2, "search_radius_km": 10.0,
    })
    return did


def test_the_last_decline_triggers_a_fresh_fan_out(fake_db, monkeypatch):
    did = _seed_open_dispatch(fake_db)
    provider = str(uuid.uuid4())
    oid = _seed_offer(fake_db, did, provider, distance_km=3.2)

    called = []
    import app.workers.tasks.dispatch as dispatch_tasks
    monkeypatch.setattr(dispatch_tasks, "_try_re_fan_out", called.append)

    async def _run():
        await UniversalDispatchEngine.respond_to_offer(oid, provider, accepted=False)
        # The re-fan-out is handed to a thread; give it a moment to land.
        await asyncio.sleep(0.05)

    asyncio.run(_run())
    assert called == [did]


def test_a_decline_with_others_still_pending_changes_nothing(fake_db, monkeypatch):
    """Someone else can still take it — do not widen the search yet."""
    did = _seed_open_dispatch(fake_db)
    declining = str(uuid.uuid4())
    oid = _seed_offer(fake_db, did, declining, distance_km=3.2)
    _seed_offer(fake_db, did, str(uuid.uuid4()), distance_km=5.0)

    called = []
    import app.workers.tasks.dispatch as dispatch_tasks
    monkeypatch.setattr(dispatch_tasks, "_try_re_fan_out", called.append)

    async def _run():
        await UniversalDispatchEngine.respond_to_offer(oid, declining, accepted=False)
        await asyncio.sleep(0.05)

    asyncio.run(_run())
    assert called == []
    assert fake_db.db["dispatch_requests"][0]["status"] == "provider_notified"


def test_a_chosen_provider_declining_cancels_rather_than_reoffering(fake_db, monkeypatch):
    """The patient picked this therapist by name and pays their rate.

    Handing the booking to a stranger would change the deal without asking, so
    the request is closed and the patient told to choose again. A direct offer
    carries no distance — that is what identifies one.
    """
    did = _seed_open_dispatch(fake_db, provider_type="physiotherapist")
    provider = str(uuid.uuid4())
    oid = _seed_offer(fake_db, did, provider, distance_km=None)

    called = []
    import app.workers.tasks.dispatch as dispatch_tasks
    monkeypatch.setattr(dispatch_tasks, "_try_re_fan_out", called.append)

    sent = []
    from app.services import notification_engine as ne

    async def _capture(**kwargs):
        sent.append(kwargs)
        return []

    monkeypatch.setattr(ne.NotificationEngine, "send_multi", staticmethod(_capture))

    async def _run():
        await UniversalDispatchEngine.respond_to_offer(oid, provider, accepted=False)
        await asyncio.sleep(0.05)

    asyncio.run(_run())
    assert called == []
    assert fake_db.db["dispatch_requests"][0]["status"] == "cancelled"
    assert sent, "the patient must be told their chosen provider declined"

# ── 5. The 80/20 split has one definition ────────────────────────────────────

def test_every_split_reads_the_same_platform_fee(fake_db, monkeypatch):
    """Four files each carried their own literal 20, and one of them could
    drift without the others noticing. They now resolve the same figure.
    """
    import app.services.marketplace as marketplace_mod
    import app.services.payment as payment_svc
    from app.services.scope_catalogs import compute_commercial_split

    monkeypatch.setattr(
        marketplace_mod.PricingService, "platform_fee_pct", staticmethod(lambda: 25.0)
    )

    assert payment_svc._platform_fee_rate() == 0.25
    split = compute_commercial_split(1000.0)
    assert split["platform_fee_amount"] == 250.0
    assert split["provider_share_amount"] == 750.0


def test_the_mou_split_is_twenty_eighty_by_default(fake_db):
    """Every partner MOU fixes the same share: 20% platform, 80% provider."""
    from app.services.scope_catalogs import compute_commercial_split

    split = compute_commercial_split(1000.0)
    assert split["platform_fee_amount"] == 200.0
    assert split["provider_share_amount"] == 800.0


# ── 6. A consultation's price is the provider's, not the browser's ───────────

def _seed_provider_fees(fake, table, user_id, consult, home):
    fake.db.setdefault(table, []).append({
        "user_id": user_id, "consultation_fee": consult, "home_visit_fee": home,
    })


def test_home_visit_is_charged_at_the_published_home_rate(monkeypatch):
    import app.routers.bookings as bookings_mod

    fake = FakeSupabase()
    monkeypatch.setattr(bookings_mod, "supabase", fake)
    physio = str(uuid.uuid4())
    _seed_provider_fees(fake, "physiotherapists", physio, 400.0, 900.0)

    assert bookings_mod._resolve_provider_fee(physio, "physiotherapist", "home_visit") == 900.0
    assert bookings_mod._resolve_provider_fee(physio, "physiotherapist", "online") == 400.0


def test_a_provider_type_with_no_published_rate_is_left_alone(monkeypatch):
    """Organisations price through slot allotment — the caller's figure stands."""
    import app.routers.bookings as bookings_mod

    fake = FakeSupabase()
    monkeypatch.setattr(bookings_mod, "supabase", fake)
    assert bookings_mod._resolve_provider_fee(str(uuid.uuid4()), "organization", "in_person") is None


def test_an_unset_fee_is_not_treated_as_free(monkeypatch):
    import app.routers.bookings as bookings_mod

    fake = FakeSupabase()
    monkeypatch.setattr(bookings_mod, "supabase", fake)
    doctor = str(uuid.uuid4())
    _seed_provider_fees(fake, "doctors", doctor, 0.0, 0.0)
    assert bookings_mod._resolve_provider_fee(doctor, "doctor", "online") is None


# ── 7. An abandoned job goes back to the pool ────────────────────────────────

def test_releasing_an_accepted_job_re_offers_it(fake_db, monkeypatch):
    """Reverting to `searching` alone left it invisible to the sweep, which
    only re-offers where a *pending* offer expired — and this job's offers
    were all settled the moment it was accepted."""
    did = _seed_open_dispatch(fake_db)
    walker = str(uuid.uuid4())
    _seed_offer(fake_db, did, walker, distance_km=2.0, status="accepted")

    called = []
    import app.workers.tasks.dispatch as dispatch_tasks
    monkeypatch.setattr(dispatch_tasks, "_try_re_fan_out", called.append)

    async def _run():
        await UniversalDispatchEngine.release_and_refill(did, walker)
        await asyncio.sleep(0.05)

    asyncio.run(_run())
    assert called == [did]
    # Their offer must be retired, or the re-fan-out hands the job right back.
    assert fake_db.db["dispatch_offers"][0]["status"] == "rejected"
