"""
Production cleanup: remove stale/duplicate/rejected data so that
ONLY genuine, verified records appear on the patient-facing directory.

provider_directory is a VIEW built from provider_settings + other tables,
so we update provider_settings.is_listed to control visibility.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app.database import get_supabase_client
supabase = get_supabase_client()

# IDs
GENUINE_UID = '4c27cf20-e922-4412-a6e9-a3613607ce21'
GENUINE_ORG_ID = 'c2d8b199-77c4-4f7a-9307-59aedf0f4998'
GENUINE_DOC_UID = 'e713e870-4f61-411d-bfe1-1387f0f59c61'

FAKE_UID = '36063ba5-34c0-41fb-ba56-af837d999e58'
FAKE_ORG_ID = '18571ac4-53ba-4d0f-ae4e-57bc8e476c80'

STALE_ORG_USER_ID = '4bf43e12-b1ac-4c13-a7c7-0f097b53e8f8'  # rejected duplicate VMSC
STALE_ORG_ID = 'a9fd4d36-e2f4-44e3-b0d3-45fd65558b14'

PENDING_DOC_UID = 'eeb72042-8fb8-4526-88d8-e6a80151ec06'  # pending duplicate doctor

print("=" * 60)
print("STEP 1: Unlist rejected duplicate VMSC registration")
print("=" * 60)
try:
    supabase.table('provider_settings').upsert({
        'provider_user_id': STALE_ORG_USER_ID,
        'is_listed': False,
    }).execute()
    print(f"  [OK] Unlisted rejected org user {STALE_ORG_USER_ID}")
except Exception as e:
    print(f"  [ERR] {e}")

print()
print("=" * 60)
print("STEP 2: Unlist pending duplicate doctor registration")
print("=" * 60)
try:
    supabase.table('provider_settings').upsert({
        'provider_user_id': PENDING_DOC_UID,
        'is_listed': False,
    }).execute()
    print(f"  [OK] Unlisted pending duplicate doctor {PENDING_DOC_UID}")
except Exception as e:
    print(f"  [ERR] {e}")

print()
print("=" * 60)
print("STEP 3: Remove organization_doctors from stale org")
print("=" * 60)
try:
    res = supabase.table('organization_doctors').delete().eq('organization_id', STALE_ORG_ID).execute()
    count = len(res.data or [])
    print(f"  [OK] Removed {count} stale doctor link(s) from org {STALE_ORG_ID}")
except Exception as e:
    print(f"  [ERR] {e}")

print()
print("=" * 60)
print("STEP 4: Remove organization_doctors from fake org (if any)")
print("=" * 60)
try:
    existing = supabase.table('organization_doctors').select('id').eq('organization_id', FAKE_ORG_ID).execute().data or []
    if existing:
        res = supabase.table('organization_doctors').delete().eq('organization_id', FAKE_ORG_ID).execute()
        count = len(res.data or [])
        print(f"  [OK] Removed {count} doctor link(s) from fake org {FAKE_ORG_ID}")
    else:
        print(f"  [OK] No links to remove from fake org (already clean)")
except Exception as e:
    print(f"  [ERR] {e}")

print()
print("=" * 60)
print("VERIFICATION: Final state")
print("=" * 60)

# Check provider_directory listed + verified
pd = supabase.table('provider_directory').select(
    'provider_user_id, display_name, subtype, verification_status, is_listed'
).eq('is_listed', True).eq('verification_status', 'verified').execute().data or []
print(f"\nListed + Verified providers in directory: {len(pd)}")
for p in pd:
    print(f"  {p['display_name']} ({p['subtype']}) -- {p['provider_user_id']}")

# Check organization_doctors
od = supabase.table('organization_doctors').select('*').execute().data or []
print(f"\nActive organization_doctors links: {len(od)}")
for o in od:
    print(f"  org={o['organization_id']} doctor={o['doctor_user_id']} spec={o['specialization']} fee={o['consultation_fee']}")

# Check availability
avail = supabase.table('doctor_availability').select('doctor_id, day_of_week, start_time, end_time, location_name, template_group_id').eq('doctor_id', GENUINE_DOC_UID).eq('is_active', True).order('day_of_week').order('start_time').execute().data or []
print(f"\nDr. Naidu active availability blocks: {len(avail)}")
for a in avail:
    branch_type = "Branch" if a['template_group_id'] else "Main"
    print(f"  Day {a['day_of_week']}: {a['start_time'][:5]}-{a['end_time'][:5]} @ {a['location_name']} [{branch_type}]")

# Check branches
branches = supabase.table('provider_branches').select('*').eq('provider_user_id', GENUINE_UID).eq('is_active', True).execute().data or []
print(f"\nActive branches for VMSC: {len(branches)}")
for b in branches:
    print(f"  {b['name']} -- {b['address']}, {b['city']} (ID: {b['id']})")

print("\n[DONE] Cleanup complete. Only genuine, verified data is patient-visible.")
