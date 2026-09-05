"""
One-off data repair for the defects fixed alongside it.

Run the DDL first (database/task14_registration_integrity.sql), then:

    python backend/scripts/repair_location_and_profiles.py            # dry run
    python backend/scripts/repair_location_and_profiles.py --apply    # write

Dry run is the default and prints every row it would touch. Nothing here is
destructive: it only fills in values that are missing or inconsistent, and it
never overwrites a professional credential or a verification decision.

What it repairs, and why each one exists
----------------------------------------
1. Provider users with no role-profile row.
   `_create_role_profile` used to swallow a failed insert into an in-process
   dict, so a provider could finish signup, log in and use their own dashboard
   while having no row in `doctors` at all. Every patient-facing search joins
   that table, so they were invisible to patients. The rebuilt row is blank and
   `verification_status='pending'` on purpose — this script does not invent
   credentials and does not verify anybody.

2. City / district / state spelling.
   "Visakhapatnam" is both a city and a district, and signup collected both as
   free text: one place exists as 'Vizag', 'VISAKHAPATNAM', 'Visakhapatanam'
   and 'Vishakapatnam', with 'Andhrapradesh' / 'Andhra Pradesh' / 'india' for
   the state. Every city-equality filter in the platform missed. District is
   now the canonical unit and city mirrors it.

3. Processing centres with no coordinates.
   `_ensure_base_location` falls back to the centre's position when a collector
   has no GPS fix. The column was never populated, so that last resort always
   failed.

4. Phlebotomists with no base location.
   The advance roster pass requires one, and none existed — so the pass had no
   candidates and assigned nobody, every night. Seeded from the collector's own
   last known position.
"""
import os
import sys
from typing import Any, Dict, List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv  # noqa: E402
from supabase import create_client  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# District aliases seen in the live data. Extend as new cities onboard; the
# same mapping lives in frontend/src/components/StateDistrictPicker.tsx, which
# is what stops new signups from adding to this list.
DISTRICT_ALIASES = {
    "vizag": "Visakhapatnam",
    "visakhapatnam": "Visakhapatnam",
    "vishakapatnam": "Visakhapatnam",
    "vishakhapatnam": "Visakhapatnam",
    "visakhapatanam": "Visakhapatnam",
    "madhavadhara": "Visakhapatnam",   # a locality, not a district
    "tenali": "Guntur",                # a town inside Guntur district
    "guntur": "Guntur",
    "hyderabad": "Hyderabad",
}
STATE_ALIASES = {
    "andhrapradesh": "Andhra Pradesh",
    "andhra pradesh": "Andhra Pradesh",
    "ap": "Andhra Pradesh",
    "india": "Andhra Pradesh",         # a country in the state column
    "telangana": "Telangana",
    "tg": "Telangana",
}
# Districts we can position without a geocoder key.
DISTRICT_COORDS = {
    "visakhapatnam": (17.6868, 83.2185),
    "guntur": (16.3067, 80.4365),
    "hyderabad": (17.3850, 78.4867),
}


def _norm(value) -> str:
    return (value or "").strip()


def main() -> int:
    apply_changes = "--apply" in sys.argv
    tag = "APPLY" if apply_changes else "DRY-RUN"

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("SUPABASE_URL / SUPABASE_KEY not set — nothing to do.")
        return 1
    sb = create_client(url, key)

    def rows(result) -> List[Dict[str, Any]]:
        """Supabase's .data is loosely typed JSON; these tables return objects."""
        return [r for r in (getattr(result, "data", None) or []) if isinstance(r, dict)]

    role_tables = {
        "doctor": "doctors",
        "phlebotomist": "phlebotomists",
        "organization": "organizations",
        "patient": "patients",
        "pharmacy": "pharmacies",
        "nurse": "nurses",
    }

    # ── 1. Provider users with no role-profile row ────────────────────────
    print("[%s] 1. Missing role-profile rows" % tag)
    users = rows(sb.table("users").select(
        "id, full_name, role, city, district, state"
    ).execute())
    for role, table in role_tables.items():
        have = {r["user_id"] for r in rows(sb.table(table).select("user_id").execute())}
        for u in users:
            if u["role"] != role or u["id"] in have:
                continue
            if role != "doctor":
                print("    ! %s has no %s row — repair by hand; this script "
                      "only rebuilds doctors" % (u["full_name"], table))
                continue
            row = {
                "user_id": u["id"],
                "medical_license_number": "",
                "specialization": "",
                "qualification": "",
                "years_of_experience": 0,
                "hospital_clinic_name": "",
                "available_timings": "",
                "consultation_mode": "both",
                "available_for_online": True,
                "languages_spoken": ["English"],
                # Deliberately NOT 'verified'. Nobody has reviewed this
                # doctor's credentials; a repair script must not decide that.
                "verification_status": "pending",
            }
            print("    + doctors row for %s (%s) -> verification_status=pending"
                  % (u["full_name"], u["id"]))
            if apply_changes:
                sb.table("doctors").insert(row).execute()

    # ── 2. Canonical district / city / state ──────────────────────────────
    print("\n[%s] 2. Canonical district / city / state on users" % tag)
    for u in users:
        city = _norm(u.get("city"))
        district = _norm(u.get("district"))
        state = _norm(u.get("state"))
        canonical = (
            DISTRICT_ALIASES.get(district.lower(), district)
            or DISTRICT_ALIASES.get(city.lower(), city)
        )
        canonical_state = STATE_ALIASES.get(state.lower(), state)
        if not canonical:
            print("    ! %s has no location at all — left alone" % u["full_name"])
            continue
        if (canonical, canonical, canonical_state) == (city, district, state):
            continue
        print("    ~ %-26s city %r->%r  district %r->%r  state %r->%r"
              % (u["full_name"][:26], city, canonical, district, canonical,
                 state, canonical_state))
        if apply_changes:
            sb.table("users").update(
                {"city": canonical, "district": canonical, "state": canonical_state}
            ).eq("id", u["id"]).execute()

    # ── 3. Processing centres with no coordinates ─────────────────────────
    print("\n[%s] 3. Processing centre coordinates" % tag)
    centres = rows(sb.table("processing_centers").select(
        "id, code, name, city, lat, lng"
    ).execute())
    for c in centres:
        if c.get("lat") is not None:
            continue
        raw = _norm(c.get("city"))
        key = DISTRICT_ALIASES.get(raw.lower(), raw).lower()
        coords = DISTRICT_COORDS.get(key)
        if not coords:
            print("    ! %s city=%r — no known coordinates, add it to "
                  "DISTRICT_COORDS" % (c["code"], c.get("city")))
            continue
        print("    ~ %s lat/lng NULL -> %s" % (c["code"], coords))
        if apply_changes:
            sb.table("processing_centers").update(
                {"lat": coords[0], "lng": coords[1]}
            ).eq("id", c["id"]).execute()

    # ── 4. Phlebotomists with no base location ────────────────────────────
    print("\n[%s] 4. Phlebotomist base location" % tag)
    phlebos = rows(sb.table("phlebotomists").select(
        "user_id, base_lat, base_lng, current_lat, current_lng, processing_center_id"
    ).execute())
    centre_by_id = {c["id"]: c for c in centres}
    for p in phlebos:
        if p.get("base_lat") is not None:
            continue
        lat, lng = p.get("current_lat"), p.get("current_lng")
        source = "last known position"
        if lat is None or lng is None:
            centre = centre_by_id.get(p.get("processing_center_id")) or {}
            raw = _norm(centre.get("city"))
            key = DISTRICT_ALIASES.get(raw.lower(), raw).lower()
            coords = DISTRICT_COORDS.get(key)
            if not coords:
                print("    ! %s has no position and no locatable centre — "
                      "skipped" % p["user_id"])
                continue
            lat, lng, source = coords[0], coords[1], "their processing centre"
        print("    ~ %s base NULL -> (%s, %s) from %s"
              % (p["user_id"], lat, lng, source))
        if apply_changes:
            sb.table("phlebotomists").update(
                {"base_lat": lat, "base_lng": lng}
            ).eq("user_id", p["user_id"]).execute()

    print("\n[%s] done.%s" % (
        tag, "" if apply_changes else "  Re-run with --apply to write."))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
