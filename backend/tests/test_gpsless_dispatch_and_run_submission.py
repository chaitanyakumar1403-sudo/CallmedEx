"""
Two production breaks in the home-collection chain, and their fixes.

1. A phlebotomist who is on duty but has no live GPS fix was invisible to
   dispatch. Both candidate paths required a non-null current_lat, and the
   duty toggle writes is_online without coordinates, so a collector whose
   browser could not produce a fix (permission prompt, indoor cold start,
   a laptop with no GPS radio) sat "on duty" all day and was never offered a
   single job. Their registered base location is now the fallback.

2. Nothing ever moved a tube out of `collected`. The centre had no signal a
   run was inbound and `pending_receipt` did not count `collected` either, so
   barcoded tubes in a collector's bag existed in no dashboard tile at all.
"""
import uuid

import pytest

import app.services.dispatch_engine as engine_mod
import app.services.samples as samples_mod
from app.services.dispatch_engine import UniversalDispatchEngine
from app.services.samples import SampleService

from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(engine_mod, "supabase", fake)
    monkeypatch.setattr(samples_mod, "supabase", fake)
    monkeypatch.setattr(
        engine_mod.EmailService, "send_magic_dispatch_email",
        staticmethod(lambda **_kw: None),
    )
    return fake


def _seed_phlebo(fake, *, centre_id, live=None, base=None, name="Collector"):
    """On duty and verified. `live` / `base` are (lat, lng) or None."""
    uid = str(uuid.uuid4())
    fake.db.setdefault("provider_locations", []).append({
        "user_id": uid, "provider_type": "phlebotomist", "is_online": True,
        "current_lat": live[0] if live else None,
        "current_lng": live[1] if live else None,
        "users": {"id": uid, "full_name": name, "mobile": "9000000000",
                  "email": f"{uid[:8]}@test.local",
                  "verification_status": "verified"},
    })
    fake.db.setdefault("phlebotomists", []).append({
        "user_id": uid, "processing_center_id": centre_id,
        "on_duty": True, "verification_status": "verified",
        "current_lat": live[0] if live else None,
        "current_lng": live[1] if live else None,
        "base_lat": base[0] if base else None,
        "base_lng": base[1] if base else None,
        "users": {"id": uid, "full_name": name, "mobile": "9000000000",
                  "email": f"{uid[:8]}@test.local"},
    })
    return uid


# ── 1. GPS-less collectors are still dispatchable ────────────────────────────

@pytest.mark.asyncio
async def test_on_duty_phlebo_without_a_gps_fix_is_still_offered_work(fake_db):
    """The exact reported symptom: on duty, GPS erroring, no alerts ever."""
    uid = _seed_phlebo(fake_db, centre_id="c1", live=None, base=(17.3900, 78.4900))

    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist", processing_center_id="c1")

    assert [c["user_id"] for c in found] == [uid]
    assert found[0]["location_source"] == "base"


@pytest.mark.asyncio
async def test_a_live_fix_still_wins_over_the_base_location(fake_db):
    """The fallback must not degrade ranking for collectors who do report GPS."""
    near_live = _seed_phlebo(fake_db, centre_id="c1", live=(17.3860, 78.4880),
                             base=(17.9000, 78.9000), name="Live and near")
    far_base = _seed_phlebo(fake_db, centre_id="c1", live=None,
                            base=(17.4300, 78.5300), name="Base only")

    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist", processing_center_id="c1")

    assert [c["user_id"] for c in found] == [near_live, far_base]
    assert found[0]["location_source"] == "live"


@pytest.mark.asyncio
async def test_a_collector_with_no_location_at_all_is_not_dispatched(fake_db):
    """Falling back must not degrade into dispatching to an unknown address."""
    _seed_phlebo(fake_db, centre_id="c1", live=None, base=None)

    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist", processing_center_id="c1")

    assert found == []


@pytest.mark.asyncio
async def test_routine_home_collection_still_respects_the_service_radius(fake_db):
    """Same centre is necessary, never sufficient — 60+ km is not a home visit."""
    _seed_phlebo(fake_db, centre_id="c1", live=(17.9000, 78.9000))

    found = await UniversalDispatchEngine.find_nearby_providers(
        17.3851, 78.4871, "phlebotomist", processing_center_id="c1")

    assert found == []


# ── 2. End-of-run submission to the processing centre ────────────────────────

def _seed_sample(fake, *, phlebo_id, centre_id, status="collected", barcode="CMX-1"):
    sid = str(uuid.uuid4())
    fake.db.setdefault("samples", []).append({
        "id": sid, "barcode": barcode, "status": status,
        "phlebotomist_user_id": phlebo_id, "processing_center_id": centre_id,
    })
    return sid


def test_submitting_a_run_moves_collected_tubes_into_transit(fake_db):
    uid = _seed_phlebo(fake_db, centre_id="c1", live=(17.38, 78.48))
    fake_db.db.setdefault("processing_centers", []).append(
        {"id": "c1", "code": "VSP-01", "name": "Vizag Central", "city": "Visakhapatnam"}
    )
    sid = _seed_sample(fake_db, phlebo_id=uid, centre_id="c1")

    result = SampleService.submit_run_to_centre(uid)

    assert result["success"] is True
    assert result["submitted_count"] == 1
    assert result["processing_center_name"] == "Vizag Central"
    moved = next(s for s in fake_db.db["samples"] if s["id"] == sid)
    assert moved["status"] == "in_transit"


def test_a_tube_belonging_to_another_centre_is_never_walked_into_this_one(fake_db):
    uid = _seed_phlebo(fake_db, centre_id="c1", live=(17.38, 78.48))
    fake_db.db.setdefault("processing_centers", []).append(
        {"id": "c1", "code": "VSP-01", "name": "Vizag Central", "city": "Visakhapatnam"}
    )
    other = _seed_sample(fake_db, phlebo_id=uid, centre_id="c2", barcode="CMX-OTHER")

    result = SampleService.submit_run_to_centre(uid)

    assert result["success"] is False
    assert "CMX-OTHER" in result["skipped_other_centre"]
    assert next(s for s in fake_db.db["samples"] if s["id"] == other)["status"] == "collected"


def test_a_collector_with_no_centre_cannot_submit_a_run(fake_db):
    uid = _seed_phlebo(fake_db, centre_id=None, live=(17.38, 78.48))
    _seed_sample(fake_db, phlebo_id=uid, centre_id=None)

    result = SampleService.submit_run_to_centre(uid)

    assert result["success"] is False
    assert "processing centre" in result["message"]


def test_get_home_lab_reports_the_assigned_processing_centre(fake_db):
    """Was null for every PC-model collector, so the UI had nowhere to submit."""
    uid = _seed_phlebo(fake_db, centre_id="c1", live=(17.38, 78.48))
    fake_db.db.setdefault("processing_centers", []).append(
        {"id": "c1", "code": "VSP-01", "name": "Vizag Central", "city": "Visakhapatnam",
         "partner_lab_name": "SECRET PARTNER LAB"}
    )

    lab = SampleService.get_home_lab(uid)

    assert lab["processing_center_name"] == "Vizag Central"
    assert lab["destination_kind"] == "processing_center"
    # Partner lab identity is internal-only and must never reach a provider.
    assert "SECRET PARTNER LAB" not in str(lab)
