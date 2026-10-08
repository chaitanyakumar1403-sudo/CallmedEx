"""
Lab test / health package home-collection flow — regression checks for the
production fixes of 2026-10-07:

  * past (or too-close) slots are refused server-side
  * a slot is full at collector capacity, not after one booking per city
  * a collector may only move their own visit, one legal step at a time,
    and accepting a job no longer marks the booking "in progress"
  * doorstep writes require the assigned collector, at the door (OTP done)
  * the stale sweep closes accepted-but-never-serviced bookings, and keeps
    any booking whose tube was actually collected
  * full-time collectors serve 20 km
  * a report delivered through MediAssist/KriyaAI closes out the tube
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

import app.routers.bookings as bookings_mod
import app.routers.mediassist_inbound as inbound_mod
import app.routers.phlebo_doorstep as doorstep_mod
import app.services.dispatch_engine as engine_mod
import app.services.roster as roster_mod
from tests.test_sample_lifecycle import FakeSupabase

IST = timezone(timedelta(hours=5, minutes=30))


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase()
    for mod in (bookings_mod, inbound_mod, doorstep_mod, engine_mod, roster_mod):
        monkeypatch.setattr(mod, "supabase", fake)
    return fake


def _ist(dt: datetime) -> str:
    return dt.astimezone(IST).strftime("%Y-%m-%dT%H:%M:00+05:30")


# ── Past slots ─────────────────────────────────────────────────────────────

def test_past_and_too_close_slots_are_refused():
    now = datetime.now(IST)
    with pytest.raises(HTTPException) as e:
        bookings_mod._reject_past_slot(_ist(now - timedelta(hours=2)), None, False)
    assert e.value.status_code == 422
    # Doorstep collection needs the lead time; a clinic visit does not.
    soon = _ist(now + timedelta(minutes=15))
    with pytest.raises(HTTPException):
        bookings_mod._reject_past_slot(soon, None, True)
    bookings_mod._reject_past_slot(soon, None, False)
    bookings_mod._reject_past_slot(_ist(now + timedelta(hours=3)), None, True)
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    with pytest.raises(HTTPException):
        bookings_mod._reject_past_slot(None, yesterday, False)
    bookings_mod._reject_past_slot(None, now.strftime("%Y-%m-%d"), False)


# ── Slot capacity ──────────────────────────────────────────────────────────

def test_slot_capacity_counts_collectors_not_one_per_city(db, monkeypatch):
    date = "2030-01-15"
    for _ in range(2):
        db.db.setdefault("bookings", []).append({
            "id": str(uuid.uuid4()), "booking_kind": "home_collection", "status": "confirmed",
            "collection_city": "Visakhapatnam", "slot_id": f"x|{date}|06:00",
        })
    assert bookings_mod._home_slot_counts("Visakhapatnam", date) == {"06:00": 2}
    monkeypatch.setattr(roster_mod, "_city_phlebos", lambda city, d: [{}, {}, {}])
    assert bookings_mod._home_slot_capacity("Visakhapatnam", date) == 3  # 06:00 still open
    monkeypatch.setattr(roster_mod, "_city_phlebos", lambda city, d: [])
    assert bookings_mod._home_slot_capacity("Visakhapatnam", date) == 1  # never zero


# ── Dispatch status guard ──────────────────────────────────────────────────

def _dispatch(db, status, provider):
    did, bid = str(uuid.uuid4()), str(uuid.uuid4())
    db.db.setdefault("dispatch_requests", []).append({
        "id": did, "booking_id": bid, "status": status,
        "assigned_provider_id": provider, "provider_type": "phlebotomist",
    })
    db.db.setdefault("bookings", []).append({"id": bid, "status": "provider_accepted"})
    return did, bid


@pytest.mark.asyncio
async def test_provider_cannot_move_someone_elses_visit_or_skip_the_otp(db):
    did, _ = _dispatch(db, "provider_accepted", "phlebo-a")
    other = await engine_mod.UniversalDispatchEngine.update_status(did, "en_route", provider_id="phlebo-b")
    assert other["success"] is False
    skip = await engine_mod.UniversalDispatchEngine.update_status(did, "completed", provider_id="phlebo-a")
    assert skip["success"] is False
    assert db.db["dispatch_requests"][0]["status"] == "provider_accepted"


@pytest.mark.asyncio
async def test_on_the_way_is_not_in_progress_for_the_booking(db):
    did, bid = _dispatch(db, "provider_accepted", "phlebo-a")
    res = await engine_mod.UniversalDispatchEngine.update_status(did, "en_route", provider_id="phlebo-a")
    assert res["success"] is True
    booking = next(b for b in db.db["bookings"] if b["id"] == bid)
    assert booking["status"] == "provider_accepted"


# ── Doorstep assignment gate ───────────────────────────────────────────────

def test_doorstep_writes_need_the_assigned_collector_at_the_door(db):
    _, bid = _dispatch(db, "provider_accepted", "phlebo-a")
    with pytest.raises(HTTPException) as e:
        doorstep_mod._require_assigned({"sub": "phlebo-b", "role": "phlebotomist"}, bid)
    assert e.value.status_code == 403
    doorstep_mod._require_assigned({"sub": "phlebo-a", "role": "phlebotomist"}, bid)  # read ok
    with pytest.raises(HTTPException) as e:
        doorstep_mod._require_assigned({"sub": "phlebo-a", "role": "phlebotomist"}, bid, at_door=True)
    assert e.value.status_code == 409
    db.db["dispatch_requests"][0]["status"] = "in_progress"
    doorstep_mod._require_assigned({"sub": "phlebo-a", "role": "phlebotomist"}, bid, at_door=True)
    doorstep_mod._require_assigned({"sub": "x", "role": "admin"}, bid, at_door=True)


# ── Stale sweep ────────────────────────────────────────────────────────────

def _stale_booking(db, status="provider_accepted"):
    bid = str(uuid.uuid4())
    yesterday = (datetime.now(IST) - timedelta(days=1)).strftime("%Y-%m-%d")
    db.db.setdefault("bookings", []).append({
        "id": bid, "patient_id": "p-1", "status": status, "notes": "",
        "slot_start": f"{yesterday}T06:30:00+05:30", "service_type": "lab_test",
    })
    return bid


def test_accepted_but_never_serviced_booking_is_closed(db):
    bid = _stale_booking(db)
    db.db.setdefault("dispatch_requests", []).append(
        {"id": str(uuid.uuid4()), "booking_id": bid, "status": "provider_accepted"})
    db.db.setdefault("samples", []).append(
        {"id": str(uuid.uuid4()), "booking_id": bid, "status": "pending_collection"})
    assert bookings_mod.auto_expire_stale_bookings("p-1") == 1
    assert next(b for b in db.db["bookings"] if b["id"] == bid)["status"] == "cancelled"
    assert db.db["samples"][0]["status"] == "cancelled"
    assert db.db["dispatch_requests"][0]["status"] == "cancelled"


def test_a_booking_whose_tube_was_collected_is_never_auto_cancelled(db):
    bid = _stale_booking(db, status="in_progress")
    db.db.setdefault("samples", []).append(
        {"id": str(uuid.uuid4()), "booking_id": bid, "status": "collected"})
    assert bookings_mod.auto_expire_stale_bookings("p-1") == 0
    assert db.db["bookings"][0]["status"] == "in_progress"


# ── 20 km full-time radius ─────────────────────────────────────────────────

def test_full_time_collectors_serve_twenty_km():
    booking = {"collection_lat": 17.6868, "collection_lng": 83.2185}  # Visakhapatnam
    near = {"user_id": "ft-near", "base_lat": 17.6868 + 0.16, "base_lng": 83.2185, "phleb_type": "full_time"}  # ~18 km
    far = {"user_id": "ft-far", "base_lat": 17.6868 + 0.20, "base_lng": 83.2185, "phleb_type": "full_time"}   # ~22 km
    assert roster_mod._pick([far], booking, {}) is None
    assert roster_mod._pick([near, far], booking, {})["user_id"] == "ft-near"
    assert engine_mod.FULL_TIME_PHLEBO_RADIUS_KM == roster_mod.FULL_TIME_RADIUS_KM == 20.0


# ── KriyaAI report close-out ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delivered_report_closes_out_the_tube(db, monkeypatch):
    sid = str(uuid.uuid4())
    db.db.setdefault("samples", []).append({"id": sid, "status": "verified", "barcode": "CMX-1"})
    sent = []

    class _NE:
        @staticmethod
        async def send(**kw):
            sent.append(kw)

    import app.services.notification_engine as ne_mod
    monkeypatch.setattr(ne_mod, "NotificationEngine", _NE)
    await inbound_mod._close_out_sample(
        {"id": "job-1", "sample_id": sid, "patient_id": "p-1"}, "https://r/1.pdf", False)
    assert db.db["samples"][0]["status"] == "delivered"
    assert db.db["samples"][0]["report_url"] == "https://r/1.pdf"
    assert sent and sent[0]["user_id"] == "p-1"


# ── Barcode lookup leaks nothing off-run ───────────────────────────────────

@pytest.mark.asyncio
async def test_barcode_lookup_reveals_nothing_about_another_collectors_patient(db):
    _, bid = _dispatch(db, "in_progress", "phlebo-a")
    db.db.setdefault("samples", []).append({
        "id": str(uuid.uuid4()), "booking_id": bid, "patient_id": "p-9",
        "barcode": "CMX-OTHER1", "status": "pending_collection",
    })
    req = doorstep_mod.VerifyBarcodeRequest(barcode="CMX-OTHER1")
    res = await doorstep_mod.verify_barcode(req, user={"sub": "phlebo-b", "role": "phlebotomist"})
    assert res["case"] == "NOT_ASSIGNED" and res["valid"] is False
    assert "patient_name" not in res and "booking_id" not in res


# ── Re-base on registered address ──────────────────────────────────────────

def test_rebase_overwrites_only_when_the_address_geocodes(db, monkeypatch):
    db.db.setdefault("phlebotomists", []).append({"user_id": "ph-1", "base_lat": 1.0, "base_lng": 1.0})
    E = engine_mod.UniversalDispatchEngine
    monkeypatch.setattr(E, "_geocode_registered_address", staticmethod(lambda uid: (None, None)))
    assert E.rebase_phlebotomist("ph-1") is None
    assert db.db["phlebotomists"][0]["base_lat"] == 1.0          # never cleared
    monkeypatch.setattr(E, "_geocode_registered_address", staticmethod(lambda uid: (17.7, 83.2)))
    assert E.rebase_phlebotomist("ph-1") == (17.7, 83.2)
    assert db.db["phlebotomists"][0]["base_lat"] == 17.7


# ── Manual assignment fallback ─────────────────────────────────────────────

def _centre_setup(db):
    centre, date = "pc-1", "2030-01-20"
    for uid, lat in (("ph-near", 17.70), ("ph-far", 17.90)):  # ~1.5 km, ~24 km
        db.db.setdefault("phlebotomists", []).append({
            "user_id": uid, "processing_center_id": centre, "base_lat": lat,
            "base_lng": 83.2185, "phleb_type": "full_time", "verification_status": "verified",
        })
        db.db.setdefault("users", []).append({"id": uid, "full_name": uid, "mobile": "", "role": "phlebotomist"})
    bid = str(uuid.uuid4())
    db.db.setdefault("bookings", []).append({
        "id": bid, "processing_center_id": centre, "collection_date": date,
        "booking_kind": "home_collection", "status": "confirmed", "patient_id": "p-1",
        "slot_id": f"x|{date}|07:00", "collection_lat": 17.6868, "collection_lng": 83.2185,
        "notes": "Collection address: MVP Colony", "selected_tests": ["CBC"],
    })
    return centre, date, bid


@pytest.mark.asyncio
async def test_centre_sees_unplaced_collection_with_nearest_first_and_can_assign(db, monkeypatch):
    centre, date, bid = _centre_setup(db)
    db.db.setdefault("dispatch_requests", []).append(
        {"id": "d-1", "booking_id": bid, "status": "needs_manual_assignment", "assigned_provider_id": None})
    queue = roster_mod.manual_assignment_queue(centre, date)
    assert [q["booking_id"] for q in queue] == [bid]
    assert queue[0]["reason"] == "auto_assignment_failed"
    assert [s["user_id"] for s in queue[0]["suggestions"]] == ["ph-near", "ph-far"]
    assert queue[0]["suggestions"][0]["within_radius"] and not queue[0]["suggestions"][1]["within_radius"]

    import app.services.notification_engine as ne_mod

    class _NE:
        @staticmethod
        async def send_multi(**kw):
            return None

    monkeypatch.setattr(ne_mod, "NotificationEngine", _NE)
    await roster_mod.manual_assign(centre, bid, "ph-near", "pc-admin")
    d = db.db["dispatch_requests"][0]
    assert (d["assigned_provider_id"], d["status"], d["assignment_mode"]) == ("ph-near", "provider_accepted", "advance")
    assert len(db.db["dispatch_requests"]) == 1                     # reused, not duplicated
    assert roster_mod.manual_assignment_queue(centre, date) == []   # placed → leaves the list
    with pytest.raises(ValueError):                                  # cannot assign twice
        await roster_mod.manual_assign(centre, bid, "ph-far", "pc-admin")


@pytest.mark.asyncio
async def test_manual_assign_respects_centre_and_live_offers(db):
    centre, _, bid = _centre_setup(db)
    with pytest.raises(PermissionError):
        await roster_mod.manual_assign("pc-other", bid, "ph-near", "x")
    db.db.setdefault("dispatch_requests", []).append(
        {"id": "d-2", "booking_id": bid, "status": "provider_notified", "assigned_provider_id": None})
    with pytest.raises(ValueError):                                  # live offer still out
        await roster_mod.manual_assign(centre, bid, "ph-near", "x")


# ── Internal / admin accounts never get a patient's collection ─────────────

def test_internal_test_account_and_admin_are_never_assigned_even_when_nearest(db):
    booking = {"collection_lat": 17.6868, "collection_lng": 83.2185, "processing_center_id": "pc-1",
               "slot_id": "x|2030-01-20|06:00"}
    for uid, lat in (("internal", 17.69), ("owner", 17.69), ("real", 17.73)):
        db.db.setdefault("phlebotomists", []).append({
            "user_id": uid, "processing_center_id": "pc-1", "base_lat": lat, "base_lng": 83.2185,
            "phleb_type": "full_time", "verification_status": "verified",
        })
    db.db.setdefault("users", []).extend([
        {"id": "internal", "email": "phlebo.x@callmedex.internal", "role": "phlebotomist",
         "registrant_role": "master_persona"},
        {"id": "owner", "email": "owner@example.com", "role": "admin", "registrant_role": "owner"},
        {"id": "real", "email": "real@example.com", "role": "phlebotomist"},
    ])
    picked = roster_mod.pick_advance_collector(booking, "2030-01-20")
    assert picked and picked["user_id"] == "real"


def test_candidate_filter_fails_closed_for_unconfirmed_accounts(db):
    # No users row (or no role) means not confirmed as a collector: excluded.
    db.db.setdefault("users", []).append({"id": "no-role", "email": "x@example.com"})
    people = [{"user_id": "ghost"}, {"user_id": "no-role"}]
    assert roster_mod._without_test_personas(people) == []


# ── A booking whose address failed to geocode still gets a collector ───────

def test_geocoder_falls_back_to_the_locality_never_to_the_city(monkeypatch):
    import app.services.geocoding as geo
    monkeypatch.setattr(geo.settings, "GOOGLE_MAPS_API_KEY", "")
    monkeypatch.setattr(geo.settings, "GEOAPIFY_API_KEY", "")
    monkeypatch.setattr(geo, "_geocode_cache", {})
    asked = []

    def nominatim(query):  # only knows the locality, like the real thing
        asked.append(query)
        return (17.69, 83.21) if query.startswith("Sai Residency, Gajuwaka") else None

    monkeypatch.setattr(geo, "_nominatim_geocode", nominatim)
    assert geo.geocode_address("Plot 12 Sai Residency, Gajuwaka", city="Visakhapatnam") == (17.69, 83.21)
    assert asked[0] == "Plot 12 Sai Residency, Gajuwaka, Visakhapatnam, India"

    asked.clear()
    with pytest.raises(geo.GeocodingError):
        geo.geocode_address("Flat 4, Visakhapatnam", city="Visakhapatnam")
    assert all("Flat" in q or "4" in q for q in asked)   # never queried the bare city


def _locationless_booking(db, slot_start=None):
    bid = str(uuid.uuid4())
    db.db.setdefault("bookings", []).append({
        "id": bid, "processing_center_id": "pc-1", "collection_date": "2030-01-20",
        "booking_kind": "home_collection", "status": "confirmed", "patient_id": "p-1",
        "slot_id": "x|2030-01-20|07:00", "slot_start": slot_start or "2030-01-20T07:00:00+05:30",
        "collection_lat": None, "collection_lng": None, "collection_city": "Visakhapatnam",
        "notes": "Collection address: Plot 12 Sai Residency, Gajuwaka", "selected_tests": ["CBC"],
    })
    return bid


def test_roster_pass_geocodes_and_assigns_a_booking_saved_without_a_location(db, monkeypatch):
    import app.services.geocoding as geo
    db.db.setdefault("phlebotomists", []).append({
        "user_id": "ph-1", "processing_center_id": "pc-1", "base_lat": 17.70,
        "base_lng": 83.21, "phleb_type": "full_time",
    })
    db.db.setdefault("users", []).append({"id": "ph-1", "role": "phlebotomist", "email": "ph1@example.com"})
    bid = _locationless_booking(db)
    monkeypatch.setattr(geo, "geocode_address", lambda address, city="", state="": (17.69, 83.21))

    assigned = roster_mod.run_roster_pass("pc-1", "2030-01-20")
    assert [a["phlebotomist_user_id"] for a in assigned] == ["ph-1"]
    row = next(b for b in db.db["bookings"] if b["id"] == bid)
    assert (row["collection_lat"], row["collection_lng"]) == (17.69, 83.21)


def test_same_day_sweep_geocodes_instead_of_skipping_a_location_less_booking(db, monkeypatch):
    import app.services.geocoding as geo
    import app.workers.tasks.scheduled_dispatch as sweep_mod
    monkeypatch.setattr(sweep_mod, "supabase", db)
    monkeypatch.setattr(geo, "geocode_address", lambda address, city="", state="": (17.69, 83.21))
    soon = _ist(datetime.now(IST) + timedelta(minutes=30))
    bid = _locationless_booking(db, slot_start=soon)
    sent = []

    async def create_dispatch(**kw):
        sent.append(kw)

    monkeypatch.setattr(engine_mod.UniversalDispatchEngine, "create_dispatch", create_dispatch)
    sweep_mod.trigger_dispatch_for_upcoming_bookings()
    assert [(s["booking_id"], s["patient_lat"], s["patient_lng"]) for s in sent] == [(bid, 17.69, 83.21)]
