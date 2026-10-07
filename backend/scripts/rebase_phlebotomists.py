"""
One-off: re-anchor every phlebotomist's base location on their registered address.

The 20 km (full-time) / 15 km (part-time) service radius is measured from
phlebotomists.base_lat/base_lng. Until 2026-10-07 that base was taken from
wherever the collector happened to be on their first duty toggle, and never
changed again. New signups are now anchored on their registered address;
this script brings existing collectors in line.

    python backend/scripts/rebase_phlebotomists.py            # dry run
    python backend/scripts/rebase_phlebotomists.py --apply    # write

Safe by construction: a collector whose address cannot be geocoded keeps the
base they have — nothing is ever cleared.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.database import supabase  # noqa: E402
from app.services.dispatch_engine import UniversalDispatchEngine as E  # noqa: E402
from app.services.processing_center import haversine_km  # noqa: E402


def main(apply: bool) -> None:
    if not supabase:
        sys.exit("Database not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY).")
    rows = supabase.table("phlebotomists").select("user_id, base_lat, base_lng").execute().data or []
    moved = kept = 0
    for r in rows:
        uid = r["user_id"]
        lat, lng = E._geocode_registered_address(uid)
        if lat is None or lng is None:
            kept += 1
            print(f"KEEP   {uid}: address could not be geocoded; base unchanged")
            continue
        old = (r.get("base_lat"), r.get("base_lng"))
        shift = (f"{haversine_km(float(old[0]), float(old[1]), lat, lng):.1f} km"
                 if None not in old else "no previous base")
        print(f"{'SET ' if apply else 'WOULD'}  {uid}: ({lat:.5f}, {lng:.5f})  [{shift}]")
        if apply:
            E.rebase_phlebotomist(uid)
        moved += 1
    print(f"\n{len(rows)} phlebotomists: {moved} {'re-based' if apply else 'to re-base'}, {kept} kept.")
    if not apply:
        print("Dry run — re-run with --apply to write.")


if __name__ == "__main__":
    main("--apply" in sys.argv)
