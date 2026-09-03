"""
End-to-end flow gap regressions.

Each test here pins a break that let a journey *look* like it worked while
nothing reached the other side:

  1. The dispatch sweep expired offers a full window late and then cancelled
     the dispatch on created_at, so re-fan-out was killed in the same pass that
     created it — a phlebotomist request could never recover from one decline.
  2. Telemedicine write endpoints took only a consultation_id, so any account
     could finalize someone else's consultation into an e-prescription, or
     order medicines against a stranger's prescription.
  3. The post-consultation "1-click order" wrote a bare dispatch_requests row
     with no coordinates and no offers — nobody was ever notified.
  4. Home-nursing clinical logs were readable and writable by any authenticated
     account holding a booking id.
"""
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_sample_lifecycle import FakeSupabase


def _iso(dt):
    return dt.isoformat()


# ── 1. Dispatch sweep: offers expire on time, re-fan-out survives ───────────

@pytest.fixture
def sweep_db(monkeypatch):
    import app.workers.tasks.dispatch as sweep_mod
    fake = FakeSupabase()
    monkeypatch.setattr(sweep_mod, "supabase", fake)
    # Isolate the sweep itself: re-fan-out and the alerting path have their own
    # dependencies (engine, ops alerts, notifications) that are not under test.
    monkeypatch.setattr(sweep_mod, "_try_re_fan_out", lambda _id: None)
    monkeypatch.setattr(sweep_mod, "_alert_no_provider", lambda _row: None)
    return fake, sweep_mod


def test_an_offer_expires_at_its_own_deadline_not_a_window_later(sweep_db):
    """expires_at is already offered_at + 10 min. Sweeping on `now - 10 min`
    meant offers only died at ~20 minutes, by which point the dispatch had
    already been cancelled — which is why re-fan-out never ran."""
    fake, sweep_mod = sweep_db
    now = datetime.now(timezone.utc)

    fake.db["dispatch_offers"] = [{
        "id": "offer-1",
        "dispatch_request_id": "disp-1",
        "provider_id": "phlebo-1",
        "status": "pending",
        # Offered 11 minutes ago, so its 10-minute deadline passed a minute ago.
        "expires_at": _iso(now - timedelta(minutes=1)),
    }]
    fake.db["dispatch_requests"] = [{
        "id": "disp-1", "status": "searching", "patient_id": "pat-1",
        "created_at": _iso(now - timedelta(minutes=11)),
        "updated_at": _iso(now - timedelta(minutes=11)),
    }]

    sweep_mod.expire_stale_dispatches()

    assert fake.db["dispatch_offers"][0]["status"] == "expired"


def test_an_offer_inside_its_window_is_left_alone(sweep_db):
    fake, sweep_mod = sweep_db
    now = datetime.now(timezone.utc)

    fake.db["dispatch_offers"] = [{
        "id": "offer-1", "dispatch_request_id": "disp-1", "provider_id": "phlebo-1",
        "status": "pending",
        "expires_at": _iso(now + timedelta(minutes=4)),
    }]
    fake.db["dispatch_requests"] = [{
        "id": "disp-1", "status": "searching", "patient_id": "pat-1",
        "created_at": _iso(now - timedelta(minutes=6)),
        "updated_at": _iso(now - timedelta(minutes=6)),
    }]

    sweep_mod.expire_stale_dispatches()

    assert fake.db["dispatch_offers"][0]["status"] == "pending"


def test_a_freshly_re_fanned_dispatch_is_not_cancelled_in_the_same_sweep(sweep_db):
    """The killer bug: the cancel filter keyed on created_at, so a dispatch
    that had just been re-offered to a new set of providers (updated_at = now)
    was cancelled anyway the moment it aged past one window."""
    fake, sweep_mod = sweep_db
    now = datetime.now(timezone.utc)

    fake.db["dispatch_offers"] = []
    fake.db["dispatch_requests"] = [{
        "id": "disp-1", "status": "provider_notified", "patient_id": "pat-1",
        "fan_out_round": 1,
        "created_at": _iso(now - timedelta(minutes=25)),   # old request…
        "updated_at": _iso(now),                            # …but just re-offered
    }]

    sweep_mod.expire_stale_dispatches()

    assert fake.db["dispatch_requests"][0]["status"] == "provider_notified"


def test_a_dispatch_nobody_ever_touched_is_still_cancelled(sweep_db):
    fake, sweep_mod = sweep_db
    now = datetime.now(timezone.utc)

    fake.db["dispatch_offers"] = []
    fake.db["dispatch_requests"] = [{
        "id": "disp-1", "status": "searching", "patient_id": "pat-1",
        "created_at": _iso(now - timedelta(minutes=25)),
        "updated_at": _iso(now - timedelta(minutes=25)),
    }]

    sweep_mod.expire_stale_dispatches()

    row = fake.db["dispatch_requests"][0]
    assert row["status"] == "cancelled"
    assert "No provider available" in row["cancel_reason"]


def test_a_cancelled_dispatch_tells_ops_and_the_patient(monkeypatch):
    """Cancelling silently left the patient watching a tracking screen for
    someone who was never coming, and gave ops nothing to action."""
    import app.workers.tasks.dispatch as sweep_mod

    alerts, notifications = [], []

    class _Ops:
        @staticmethod
        def create_alert(**kw):
            alerts.append(kw)

    monkeypatch.setattr("app.services.ops_alerts.OpsAlertService", _Ops)

    async def _fake_send_multi(**kw):
        notifications.append(kw)
        return []

    monkeypatch.setattr(
        "app.services.notification_engine.NotificationEngine.send_multi",
        staticmethod(_fake_send_multi),
    )

    sweep_mod._alert_no_provider({
        "id": "disp-1", "patient_id": "pat-1",
        "booking_id": "book-1", "provider_type": "phlebotomist",
    })

    assert alerts and alerts[0]["alert_type"] == "dispatch_no_provider"
    assert alerts[0]["severity"] == "critical"
    assert notifications and notifications[0]["user_id"] == "pat-1"


# ── 2/3. Telemedicine authorization and post-consult ordering ──────────────

@pytest.fixture
def telemed_router():
    import app.routers.telemedicine as tm
    return tm


def _consultation(patient_id="pat-1", doctor_id="doc-1"):
    return {
        "id": "consult-1",
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "status": "waiting",
        "booking_id": None,
    }


@pytest.mark.asyncio
async def test_a_stranger_cannot_read_or_write_a_consultation(telemed_router, monkeypatch):
    from fastapi import HTTPException

    async def _get(_id):
        return _consultation()

    monkeypatch.setattr(
        telemed_router.TelemedicineService, "get_consultation", staticmethod(_get)
    )

    with pytest.raises(HTTPException) as exc:
        await telemed_router._require_participant(
            "consult-1", {"sub": "someone-else", "role": "patient"}
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("caller", [
    {"sub": "pat-1", "role": "patient"},
    {"sub": "doc-1", "role": "doctor"},
    {"sub": "admin-1", "role": "admin"},
])
async def test_participants_and_admins_are_allowed(telemed_router, monkeypatch, caller):
    async def _get(_id):
        return _consultation()

    monkeypatch.setattr(
        telemed_router.TelemedicineService, "get_consultation", staticmethod(_get)
    )
    got = await telemed_router._require_participant("consult-1", caller)
    assert got["id"] == "consult-1"


@pytest.mark.asyncio
async def test_only_the_treating_provider_can_finalize_into_a_prescription(
    telemed_router, monkeypatch
):
    """An e-prescription is a clinical artefact. The patient must not be able
    to generate their own, and neither may an unrelated doctor."""
    from fastapi import HTTPException

    async def _get(_id):
        return _consultation()

    finalized = []

    async def _finalize(consultation_id, transcript):
        finalized.append(consultation_id)
        return {}

    monkeypatch.setattr(
        telemed_router.TelemedicineService, "get_consultation", staticmethod(_get)
    )
    monkeypatch.setattr(
        telemed_router.TelemedicineService, "finalize_consultation", staticmethod(_finalize)
    )

    req = telemed_router.FinalizeConsultationRequest(
        consultation_id="consult-1", raw_transcript="notes"
    )

    with pytest.raises(HTTPException) as exc:
        await telemed_router.finalize_consultation(req, {"sub": "pat-1", "role": "patient"})
    assert exc.value.status_code == 403
    assert finalized == []

    await telemed_router.finalize_consultation(req, {"sub": "doc-1", "role": "doctor"})
    assert finalized == ["consult-1"]


@pytest.mark.asyncio
async def test_ordering_uses_the_consultations_own_patient(telemed_router, monkeypatch):
    """order-prescribed took patient_id from the caller, so holding a
    consultation id was enough to order against someone else's prescription."""
    async def _get(_id):
        return _consultation(patient_id="pat-1")

    seen = {}

    async def _order(consultation_id, patient_id, action_type, address):
        seen.update(patient_id=patient_id, action_type=action_type)
        return {"success": True}

    monkeypatch.setattr(
        telemed_router.TelemedicineService, "get_consultation", staticmethod(_get)
    )
    monkeypatch.setattr(
        telemed_router.TelemedicineService, "order_prescribed_actions", staticmethod(_order)
    )

    req = telemed_router.OrderPrescribedRequest(
        consultation_id="consult-1", action_type="pharmacy"
    )
    await telemed_router.order_prescribed_actions(req, {"sub": "admin-1", "role": "admin"})

    assert seen["patient_id"] == "pat-1"


@pytest.mark.asyncio
async def test_a_bad_action_type_is_rejected(telemed_router):
    from fastapi import HTTPException

    req = telemed_router.OrderPrescribedRequest(
        consultation_id="consult-1", action_type="anything"
    )
    with pytest.raises(HTTPException) as exc:
        await telemed_router.order_prescribed_actions(req, {"sub": "pat-1", "role": "patient"})
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_post_consult_order_goes_through_the_dispatch_engine(monkeypatch):
    """It used to insert a bare dispatch_requests row with no coordinates and
    no offers, so no provider was ever told and the sweep cancelled it."""
    import app.services.telemedicine as tm_svc
    import app.services.dispatch_engine as engine_mod

    async def _get(_id):
        return {"id": "consult-1", "patient_id": "pat-1", "booking_id": None,
                "ai_medicines": [{"generic_name": "Paracetamol"}]}

    monkeypatch.setattr(
        tm_svc.TelemedicineService, "get_consultation", staticmethod(_get)
    )
    monkeypatch.setattr(
        tm_svc.TelemedicineService,
        "_resolve_patient_location",
        staticmethod(lambda pid, addr: (17.7, 83.3, "12 MG Road, Vizag")),
    )

    created = {}

    async def _create_dispatch(**kw):
        created.update(kw)
        return {"dispatch_id": "disp-9", "all_candidates": 3, "message": "ok"}

    monkeypatch.setattr(
        engine_mod.UniversalDispatchEngine, "create_dispatch", staticmethod(_create_dispatch)
    )

    out = await tm_svc.TelemedicineService.order_prescribed_actions(
        consultation_id="consult-1", patient_id="pat-1",
        action_type="pharmacy", address="12 MG Road, Vizag",
    )

    assert out["success"] is True
    assert out["dispatch_id"] == "disp-9"
    assert out["providers_notified"] == 3
    assert created["provider_type"] == "pharmacy"
    assert created["patient_lat"] == 17.7


@pytest.mark.asyncio
async def test_post_consult_order_refuses_rather_than_guessing_a_location(monkeypatch):
    import app.services.telemedicine as tm_svc

    async def _get(_id):
        return {"id": "consult-1", "patient_id": "pat-1"}

    monkeypatch.setattr(
        tm_svc.TelemedicineService, "get_consultation", staticmethod(_get)
    )
    monkeypatch.setattr(
        tm_svc.TelemedicineService,
        "_resolve_patient_location",
        staticmethod(lambda pid, addr: (None, None, addr)),
    )

    out = await tm_svc.TelemedicineService.order_prescribed_actions(
        consultation_id="consult-1", patient_id="pat-1",
        action_type="diagnostics", address="",
    )
    assert out["success"] is False


# ── 4. Home-nursing clinical logs are PHI ──────────────────────────────────

def test_holding_the_nurse_role_is_not_authorisation_for_a_given_visit():
    """Every nurse on the platform holds role 'nurse'. Membership has to be
    checked per booking, or one nurse can write vitals onto any patient."""
    from fastapi import HTTPException
    from app.routers.nurse_visits import _require_visit_party

    booking = {
        "id": "book-1", "patient_id": "pat-1",
        "assigned_nurse_id": "nurse-1", "assigned_provider_id": None,
    }

    # Assigned nurse, the patient, and admin are fine.
    _require_visit_party(booking, "nurse-1", "nurse", "log vitals for")
    _require_visit_party(booking, "pat-1", "patient", "log vitals for")
    _require_visit_party(booking, "whoever", "admin", "log vitals for")

    # An unrelated nurse is not.
    with pytest.raises(HTTPException) as exc:
        _require_visit_party(booking, "nurse-2", "nurse", "log vitals for")
    assert exc.value.status_code == 403

    # Neither is a random authenticated account.
    with pytest.raises(HTTPException):
        _require_visit_party(booking, "stranger", "patient", "view clinical logs for")


# ── Verified-provider gate is shared by both candidate sources ─────────────

def test_verification_is_read_from_either_candidate_shape():
    from app.services.dispatch_engine import _is_verified_provider

    # Legacy role table: status on the row itself.
    assert _is_verified_provider({"verification_status": "verified"})
    # provider_locations: status on the embedded user.
    assert _is_verified_provider({"users": {"verification_status": "verified"}})

    assert not _is_verified_provider({"verification_status": "pending"})
    assert not _is_verified_provider({"users": {"verification_status": "rejected"}})
    assert not _is_verified_provider({})
    assert not _is_verified_provider({"users": {}})


# ── Patient-facing copy matches the service actually booked ────────────────

def test_status_copy_is_not_hardcoded_to_phlebotomy():
    """A patient who booked a home nurse for wound dressing was told a
    phlebotomist had started their sample collection."""
    from app.services.dispatch_engine import UniversalDispatchEngine as E

    nurse_role, nurse_visit = E._provider_labels("nurse")
    assert nurse_role == "Nurse"
    assert "Sample collection" not in nurse_visit

    phlebo_role, phlebo_visit = E._provider_labels("phlebotomist")
    assert phlebo_role == "Phlebotomist"
    assert phlebo_visit == "Sample collection"

    # An unknown/absent type degrades to neutral wording, never to phlebotomy.
    assert E._provider_labels(None) == ("Provider", "Your visit")

    title_tpl, body_tpl = E._STATUS_COPY["in_progress"]
    fields = {"provider": "Asha", "status": "in_progress", "role": nurse_role,
              "visit": nurse_visit,
              "visit_lower": nurse_visit[0].lower() + nurse_visit[1:]}
    assert "phlebotomist" not in title_tpl.format(**fields).lower()
    assert "phlebotomist" not in body_tpl.format(**fields).lower()


# ── Sample FSM covers the batching states the PC actually writes ───────────

def test_batched_and_sent_to_lab_are_real_fsm_states():
    from app.services.samples import ALLOWED_SAMPLE_TRANSITIONS, validate_sample_transition

    assert "batched" in ALLOWED_SAMPLE_TRANSITIONS
    assert "sent_to_lab" in ALLOWED_SAMPLE_TRANSITIONS

    # The path a tube actually takes through a processing centre.
    validate_sample_transition("received", "verified")
    validate_sample_transition("verified", "batched")
    validate_sample_transition("batched", "sent_to_lab")
    # A lab rejecting a tube after it was batched used to raise "Terminal".
    validate_sample_transition("batched", "rejected")
    validate_sample_transition("sent_to_lab", "report_ready")

    with pytest.raises(ValueError):
        validate_sample_transition("cancelled", "collected")
