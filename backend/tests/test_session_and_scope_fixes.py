"""
Regressions for the production defects fixed in this change.

Each test fails against the code as it was, and names the observable symptom
the user reported.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# ── 1. PC roster save answered 500 "An unexpected error occurred." ──────────
# The security middleware sanitised request bodies with a dict-only helper, so
# every endpoint taking a top-level JSON array died before routing.
def test_sanitize_json_accepts_a_top_level_array():
    from app.middleware.security import sanitize_json

    body = [
        {"phlebotomist_user_id": "u1", "status": " available ", "max_jobs": 0},
        {"phlebotomist_user_id": "u2", "status": "leave\x00", "max_jobs": 2},
    ]
    out = sanitize_json(body)

    assert isinstance(out, list) and len(out) == 2
    assert out[0]["status"] == "available"      # trimmed
    assert out[1]["status"] == "leave"          # null byte stripped
    assert out[1]["max_jobs"] == 2              # non-strings untouched


def test_sanitize_json_still_handles_objects_and_nesting():
    from app.middleware.security import sanitize_json, sanitize_dict

    nested = {"a": " x ", "b": {"c": " y "}, "d": [" z ", {"e": " w "}], "n": 3}
    out = sanitize_json(nested)
    assert out == {"a": "x", "b": {"c": "y"}, "d": ["z", {"e": "w"}], "n": 3}
    assert sanitize_dict(nested) == out         # dict entry point unchanged


# ── 2. "Visakhapatnam" was a city AND a district, spelled three ways ────────
def test_address_city_is_derived_from_district():
    from app.models.schemas import AddressInfo

    a = AddressInfo(district="Visakhapatnam", state="Andhra Pradesh")
    assert a.city == "Visakhapatnam", "city must mirror district"

    # A stale client that sends only a city still gets a district.
    b = AddressInfo(city="Vizag")
    assert b.district == "Vizag" and b.city == "Vizag"

    # When both arrive, district wins so one place has one spelling.
    c = AddressInfo(city="Vizag", district="Visakhapatnam")
    assert (c.city, c.district) == ("Visakhapatnam", "Visakhapatnam")


# ── 3. A doctor who published walk-in + online + home visit was listed under
#       none of them, because one enum column stood in for all three. ────────
def test_published_modes_beat_the_legacy_enum():
    from app.services.provider_modes import offers_mode, normalise_mode

    # Doctor publishes in_person and online blocks; enum still says "both".
    published = {"in_person", "online"}
    assert offers_mode(published, "both", "in_person")
    assert offers_mode(published, "both", "online")
    assert not offers_mode(published, "both", "home_visit")

    # Doctor publishes a home-visit tariff; the enum has no way to say that.
    assert offers_mode({"home_visit"}, "both", "home_visit")

    # Published nothing at all → fall back to the enum, never hide supply.
    assert offers_mode(set(), "both", "in_person")
    assert offers_mode(set(), "home_visit", "home_visit")
    assert not offers_mode(set(), "online", "home_visit")

    # Spelling variants all land on the canonical mode.
    assert normalise_mode("Home-Visit") == {"home_visit"}
    assert normalise_mode("teleconsultation") == {"online"}
    assert normalise_mode("both") == {"in_person", "online"}


# ── 4. Walk-in / home-visit discovery must be district-scoped; video must not.
def test_location_scope_matches_on_spelling_variants():
    from app.routers.provider_management import _matches_location

    doctor = {"city": "Vizag", "district": "Visakhapatnam", "state": "Andhrapradesh"}

    assert _matches_location(doctor, "Visakhapatnam", "Andhra Pradesh")
    assert _matches_location(doctor, "visakhapatnam", None)
    assert not _matches_location(doctor, "Hyderabad", None)
    assert not _matches_location(doctor, None, "Telangana")

    # No location filter at all (video consultation) → everyone matches.
    assert _matches_location({"city": "", "district": "", "state": ""}, None, None)


# ── 5. Advance roster assigned nobody: every phlebotomist had a NULL base. ──
class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def execute(self):
        return type("R", (), {"data": self._rows})()


def _fake_db(roster_rows, people):
    class _DB:
        def table(self, name):
            return _FakeQuery(roster_rows if name == "phlebotomist_roster" else people)

    return _DB()


def test_roster_candidates_fall_back_to_last_known_position(monkeypatch):
    from app.services import roster

    people = [
        # No base at all, but they were on duty this morning.
        {"user_id": "p1", "processing_center_id": "c1", "base_lat": None,
         "base_lng": None, "current_lat": 17.74, "current_lng": 83.27,
         "phleb_type": "full_time"},
        # Explicitly on leave tomorrow — must stay out whatever their location.
        {"user_id": "p2", "processing_center_id": "c1", "base_lat": 17.75,
         "base_lng": 83.28, "current_lat": None, "current_lng": None,
         "phleb_type": "part_time"},
        # No position anywhere — not dispatchable.
        {"user_id": "p3", "processing_center_id": "c1", "base_lat": None,
         "base_lng": None, "current_lat": None, "current_lng": None,
         "phleb_type": "full_time"},
    ]
    roster_rows = [{"phlebotomist_user_id": "p2", "status": "leave", "max_jobs": 0}]

    monkeypatch.setattr(roster, "supabase", _fake_db(roster_rows, people))
    out = roster._available_phlebos("c1", "2026-09-06")

    ids = {p["user_id"] for p in out}
    assert ids == {"p1"}, "expected only p1 to be eligible, got " + repr(ids)
    # The live fix is normalised onto base_lat/base_lng, which _pick reads.
    assert out[0]["base_lat"] == 17.74 and out[0]["base_lng"] == 83.27


def test_off_duty_today_does_not_remove_a_collector_from_tomorrow(monkeypatch):
    """Duty is a live toggle; the roster is about tomorrow.

    Only an explicit 'unavailable'/'leave' entry for that date takes someone
    out — going home tonight must not empty tomorrow's roster.
    """
    from app.services import roster

    people = [{"user_id": "p1", "processing_center_id": "c1",
               "base_lat": 17.74, "base_lng": 83.27,
               "current_lat": None, "current_lng": None,
               "phleb_type": "full_time"}]

    monkeypatch.setattr(roster, "supabase", _fake_db([], people))
    assert [p["user_id"] for p in roster._available_phlebos("c1", "2026-09-06")] == ["p1"]


def test_reassignment_radius_covers_15km_and_prefers_full_time():
    from app.services.roster import ADVANCE_RADIUS_KM, _pick

    assert ADVANCE_RADIUS_KM == 15.0

    booking = {"collection_lat": 17.7412, "collection_lng": 83.2708}
    near_part_time = {"user_id": "pt", "base_lat": 17.7420, "base_lng": 83.2715,
                      "phleb_type": "part_time"}
    far_full_time = {"user_id": "ft", "base_lat": 17.8400, "base_lng": 83.3400,
                     "phleb_type": "full_time"}     # ~13 km: inside 15, outside 10

    # The nearest collector is unavailable: the full-timer 13 km away must be
    # found rather than the booking going unassigned.
    picked = _pick([near_part_time, far_full_time], booking, {}, exclude={"pt"})
    assert picked is not None and picked["user_id"] == "ft"

    # With nobody excluded, the full-timer is still preferred for stability.
    preferred = _pick([near_part_time, far_full_time], booking, {})
    assert preferred is not None and preferred["user_id"] == "ft"

    # Beyond the radius, nobody — the booking falls back to the live offer flow.
    far_away = {"user_id": "x", "base_lat": 18.9, "base_lng": 84.9,
                "phleb_type": "full_time"}
    assert _pick([far_away], booking, {}) is None


# ── 6. A provider whose profile insert failed was created anyway, and was
#       then invisible to every patient-facing search. ───────────────────────
def test_unknown_column_is_identified_so_the_row_still_gets_written():
    from app.routers.auth import _unknown_column

    payload = {"user_id": "u", "work_setting": "solo_clinic", "is_independent": True}
    msg = ("{'message': \"Could not find the 'work_setting' column of 'doctors' "
           "in the schema cache\", 'code': 'PGRST204'}")
    assert _unknown_column(msg, payload) == "work_setting"

    pg = "column doctors.is_independent does not exist (42703)"
    assert _unknown_column(pg, payload) == "is_independent"

    # An unrelated failure must NOT be mistaken for schema drift — those have
    # to surface, not get retried with a key silently removed.
    assert _unknown_column(
        "duplicate key value violates unique constraint", payload
    ) is None
