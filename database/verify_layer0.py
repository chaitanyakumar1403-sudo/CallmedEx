"""Verify Layer 0 migration applied. Run: python database/verify_layer0.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.database import supabase

TABLES = ["provider_settings","provider_branches","provider_services","provider_packages",
          "provider_availability","provider_slots","provider_blocked_dates","verification_reviews"]

def main():
    assert supabase, "Supabase not configured (.env)"
    for t in TABLES:
        supabase.table(t).select("*").limit(1).execute()
        print(f"OK table {t}")
    rows = supabase.table("provider_directory").select("*").eq("verification_status","verified").execute()
    names = [r["display_name"] for r in rows.data]
    assert all(n and n.strip() for n in names), "directory returned a nameless row"
    print(f"OK provider_directory ({len(names)} verified rows), no nameless rows")

if __name__ == "__main__":
    main()
