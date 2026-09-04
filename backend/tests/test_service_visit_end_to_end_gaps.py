"""
Eight ways the home-service journey ended somewhere the patient could not see.

Covers the allied-health offering end to end -- physiotherapy, dietetics,
nursing, dental/diagnostic walk-ins -- from signup through booking, alerting,
dispatch and expiry.

  1. dietitian and physiotherapist were missing from MOU_REQUIRED_ROLES while
     every other partner role was there. The signup page shows them the same
     "Register & Send MOU to Email" button and the same "Check Your Email!"
     screen, so both were told to wait for an MOU that was never sent -- and
     their account was created active anyway, with no acceptance record behind
     the 80/20 split scope_catalogs bills them under.
  2. bookings never recorded consultation_mode, though it decides the price
     charged (home_visit_fee vs consultation_fee) and whether a dispatch is
     raised. Afterwards nothing could tell a home visit from a clinic visit.
  3. The org-review gate was `not resolved_provider_id`, which the allocation
     immediately above always fills in -- so it was dead. A walk-in diagnostic
     or dental booking with a date but no time was written CONFIRMED against a
     00:00-23:59 slot: the centre's pending-review queue stayed empty and
     /allot-slot refused the booking for already being confirmed.
  4. Nobody was alerted about a booking parked in that review queue.
  5. The expiry sweep re-offered a DIRECT dispatch -- the one provider the
     patient chose by name and is paying that person's rate for -- to whoever
     else was nearby. The decline path guards against this; expiry did not.
  6. The sweep cancelled the dispatch with a raw update, bypassing the
     booking-status sync, so the booking stayed "confirmed": a paid appointment
     nobody was coming to.
  7. provider_locations rows created by /dispatch/update-location filed every
     provider outside (phlebotomist, nurse, doctor) as a "phlebotomist" --
     invisible to dispatch of their own kind, visible to blood collection.
  8. /payments/create-order took provider_id from the request body, optional
     and unchecked: omit it and the payment was credited to nobody, so the
     provider's earnings read zero for work they had been paid for; supply
     someone else's and it credited their ledger.
"""
import uuid

import pytest

import app.services.dispatch_engine as engine_mod
import app.services.payment as payment_mod
import app.workers.tasks.dispatch as worker_mod

from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    for mod in (engine_mod, payment_mod, worker_mod):
        monkeypatch.setattr(mod, "supabase", fake)
    return fake


# -- 1. Every partner role signs an MOU -------------------------------------

def test_dietitians_and_physiotherapists_must_accept_an_mou():
    from app.routers.auth import MOU_REQUIRED_ROLES
    from app.models.schemas import UserRole

    for role in (UserRole.DIETITIAN, UserRole.PHYSIOTHERAPIST):
        assert role in MOU_REQUIRED_ROLES, (
            f"{role.value} is billed under an MOU it was never sent. The signup "
            "page promises one either way, so the account activated silently "
            "while the partner waited for an email."
        )
    # The patient is the only role that must NOT be gated behind one.
    assert UserRole.PATIENT not in MOU_REQUIRED_ROLES


def test_every_mou_required_role_has_a_document_to_send():
    from app.routers.auth import MOU_REQUIRED_ROLES
    from app.services.legal import LegalService, ROLE_MOU_MAP

    for role in MOU_REQUIRED_ROLES:
        assert role.value in ROLE_MOU_MAP, f"no MOU type mapped for {role.value}"
        doc = LegalService.get_active_document(role.value)
        assert doc.get("content_text"), f"{role.value} MOU has no body to send"


# -- 2. The booking records what was actually sold --------------------------

def test_booking_row_records_the_consultation_mode():
    """The mode picks the fee, so the row has to say which one was charged."""
    import inspect
    from app.routers import bookings as b

    source = inspect.getsource(b.create_booking)
    assert source.count('"consultation_mode": _normalised_mode(') == 2, (
        "both booking_data branches must persist consultation_mode; without it "
        "nothing downstream can tell a home visit from a clinic visit"
    )


def test_an_unknown_consultation_mode_cannot_break_the_insert():
    """The value is free text off the wire; the column has a CHECK constraint.

    Passing an unlisted string through would make Postgres reject the whole
    booking insert -- a bad client string turning into a failed booking rather
    than a mislabelled one.
    """
    from app.routers.bookings import _normalised_mode

    assert _normalised_mode("home_visit") == "home_visit"
    assert _normalised_mode("online") == "online"
    assert _normalised_mode("in_person") == "in_person"
    assert _normalised_mode("clinic") == "in_person"
    assert _normalised_mode("") == "in_person"
    assert _normalised_mode(None) == "in_person"

# -- 3/4. A timeless diagnostic booking waits for the centre ----------------

def test_org_review_is_decided_by_the_missing_time_not_the_provider_id():
    import inspect
    from app.routers import bookings as b

    source = inspect.getsource(b.create_booking)
    assert "needs_org_review = (" in source
    assert (
        "is_diagnostic_review and not slot_has_time and not is_home_collection"
        in source
    )
    assert "if is_diagnostic_review and not resolved_provider_id:" not in source, (
        "resolved_provider_id is always filled by the allocation above, so this "
        "gate was dead and every timeless booking was written CONFIRMED"
    )


def test_pending_review_bookings_still_alert_the_centre():
    import inspect
    from app.routers import bookings as b

    source = inspect.getsource(b.create_booking)
    assert (
        "_awaiting_review = _booking_status == BookingStatus.PENDING_REVIEW.value"
        in source
    )
    assert "if supabase and (_is_confirmed or _awaiting_review):" in source, (
        "a booking sitting in the centre's review queue reached nobody: no "
        "email, no in-app row, no push"
    )
    # ...but the patient must not be told "confirmed" before a slot exists.
    assert "if _is_confirmed and patient_row" in source
    assert "if _is_confirmed and p_email:" in source


# -- 5. A chosen provider is never swapped for a stranger -------------------

def _seed_direct_dispatch(fake, *, patient_id, booking_id, provider_id):
    """What create_direct_dispatch writes: one offer, no distance."""
    did = str(uuid.uuid4())
    fake.db.setdefault("dispatch_requests", []).append({
        "id": did,
        "patient_id": patient_id,
        "booking_id": booking_id,
        "provider_type": "physiotherapist",
        "status": "provider_notified",
        "patient_lat": 17.68,
        "patient_lng": 83.21,
        "fan_out_round": 0,
        "updated_at": "2026-01-01T00:00:00+00:00",
    })
    fake.db.setdefault("dispatch_offers", []).append({
        "id": str(uuid.uuid4()),
        "dispatch_request_id": did,
        "provider_id": provider_id,
        "status": "expired",
        "distance_km": None,
    })
    fake.db.setdefault("bookings", []).append({
        "id": booking_id, "patient_id": patient_id, "status": "confirmed",
    })
    return did


def test_an_unanswered_direct_offer_is_cancelled_not_re_offered(fake_db, monkeypatch):
    patient, booking, physio = (str(uuid.uuid4()) for _ in range(3))
    did = _seed_direct_dispatch(
        fake_db, patient_id=patient, booking_id=booking, provider_id=physio
    )

    # Any candidate search at all would mean the job was about to be handed on.
    def _must_not_search(*a, **k):
        raise AssertionError(
            "a direct dispatch was re-fanned out -- the patient paid this "
            "provider's published rate and chose them by name"
        )

    monkeypatch.setattr(
        engine_mod.UniversalDispatchEngine, "find_nearby_providers", _must_not_search
    )

    worker_mod._try_re_fan_out(did)

    row = fake_db.db["dispatch_requests"][0]
    assert row["status"] == "cancelled"
    assert "unavailable" in (row.get("cancel_reason") or "").lower()
    # No second offer was raised to anyone else.
    assert len(fake_db.db["dispatch_offers"]) == 1
    # And the patient's booking was released with it.
    assert fake_db.db["bookings"][0]["status"] == "cancelled"


def test_a_marketplace_dispatch_is_still_re_fanned(fake_db, monkeypatch):
    """The guard must key on the direct-offer marker, not disable re-fan-out."""
    patient, booking = str(uuid.uuid4()), str(uuid.uuid4())
    did = _seed_direct_dispatch(
        fake_db, patient_id=patient, booking_id=booking, provider_id=str(uuid.uuid4())
    )
    # A matched offer always carries the distance it was matched on.
    fake_db.db["dispatch_offers"][0]["distance_km"] = 3.4

    searched = {}

    async def _search(*a, **k):
        searched["yes"] = True
        return []

    monkeypatch.setattr(
        engine_mod.UniversalDispatchEngine, "find_nearby_providers", _search
    )

    worker_mod._try_re_fan_out(did)

    assert searched.get("yes"), "a matched dispatch must still look for someone else"
    assert fake_db.db["dispatch_requests"][0]["status"] != "cancelled"


# -- 6. An expired dispatch releases its booking ----------------------------

def test_expiring_a_dispatch_cancels_the_booking_it_was_for(fake_db):
    patient, booking = str(uuid.uuid4()), str(uuid.uuid4())
    fake_db.db.setdefault("bookings", []).append({
        "id": booking, "patient_id": patient, "status": "confirmed",
    })

    worker_mod._alert_no_provider({
        "id": str(uuid.uuid4()),
        "patient_id": patient,
        "booking_id": booking,
        "provider_type": "nurse",
    })

    assert fake_db.db["bookings"][0]["status"] == "cancelled", (
        "the sweep cancels the dispatch with a raw update, so the booking has "
        "to be released here or the patient keeps a paid appointment nobody "
        "is coming to"
    )


# -- 7. A provider is filed under their own type ----------------------------

def test_location_rows_are_created_under_the_providers_real_type():
    import inspect
    from app.routers import dispatch as d

    source = inspect.getsource(d.update_location_simple)
    assert (
        '"provider_type": role if role in VALID_PROVIDER_TYPES else "phlebotomist"'
        in source
    )
    assert 'role in ("phlebotomist", "nurse", "doctor")' not in source, (
        "dietitians, physiotherapists, ambulances and delivery partners were "
        "filed as phlebotomists -- invisible to their own dispatch, and offered "
        "blood collection work"
    )


def test_every_field_provider_role_is_a_valid_dispatch_type():
    from app.routers.dispatch import FIELD_PROVIDER_ROLES
    from app.services.dispatch_engine import VALID_PROVIDER_TYPES

    # admin is a console role, not a provider type; everyone else must match or
    # find_nearby_providers rejects them and they never receive an offer.
    for role in FIELD_PROVIDER_ROLES - {"admin"}:
        assert role in VALID_PROVIDER_TYPES, (
            f"{role} can reach the dispatch surfaces but can never be matched"
        )


# -- 8. The payout is credited to whoever the booking says --------------------

def test_payee_comes_from_the_booking_not_the_request_body(fake_db):
    from app.services.payment import PaymentService

    physio, booking = str(uuid.uuid4()), str(uuid.uuid4())
    fake_db.db["users"] = [{"id": physio}]
    fake_db.db["bookings"] = [{
        "id": booking, "provider_id": physio, "provider_type": "physiotherapist",
    }]

    assert PaymentService.resolve_booking_payee(booking) == physio


def test_a_diagnostic_payee_resolves_through_the_organisation(fake_db):
    """bookings.provider_id holds organizations.id for allocated diagnostics.

    get_provider_earnings filters on a users.id, so leaving the organisation id
    on the payment row left the centre's earnings page empty.
    """
    from app.services.payment import PaymentService

    org_row_id, org_login = str(uuid.uuid4()), str(uuid.uuid4())
    booking = str(uuid.uuid4())
    fake_db.db["users"] = [{"id": org_login}]
    fake_db.db["organizations"] = [{"id": org_row_id, "user_id": org_login}]
    fake_db.db["bookings"] = [{
        "id": booking, "provider_id": org_row_id, "provider_type": "organization",
    }]

    assert PaymentService.resolve_booking_payee(booking) == org_login


def test_create_order_ignores_a_client_supplied_provider_id():
    import inspect
    from app.routers import payments as pay

    source = inspect.getsource(pay.create_order)
    assert "PaymentService.resolve_booking_payee(body.booking_id)" in source
    assert "provider_id=payee_id" in source
    assert "provider_id=body.provider_id" not in source, (
        "an unchecked provider_id let a payment be credited to the wrong "
        "ledger, or to none at all when the client omitted it"
    )
