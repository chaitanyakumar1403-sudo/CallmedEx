import os, sys, asyncio
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app.routers.provider_management import search_organizations, search_providers

async def test_search():
    print("Testing search_organizations(exclude_diagnostic=True)...")
    org_res = await search_organizations(exclude_diagnostic=True)
    orgs = org_res.get("organizations", [])
    print(f"Total organizations found: {len(orgs)}")
    for o in orgs:
        print(f"Name: {o.get('organization_name')}")
        print(f"  User ID: {o.get('user_id')}")
        print(f"  Address: {o.get('address')}")
        print(f"  License: {o.get('license_number')}")
        print(f"  Head: {o.get('head_of_institution')}")
        print(f"  Branches count: {len(o.get('branches', []))}")
        for b in o.get('branches', []):
            print(f"    Branch: {b.get('id')} - {b.get('name')} ({b.get('address')})")
        print(f"  Linked Doctors count: {len(o.get('linked_doctors', []))}")
        for d in o.get('linked_doctors', []):
            print(f"    Doctor: {d.get('name')} ({d.get('specialization')}), fee: {d.get('consultation_fee')}, shifts: {len(d.get('branch_shifts', []))}")

    print("\nTesting search_providers(type='organization')...")
    prov_res = await search_providers(type="organization")
    provs = prov_res.get("providers", [])
    print(f"Total providers found: {len(provs)}")
    for p in provs:
        print(f"Provider: {p.get('provider_user_id')} - {p.get('display_name')} ({p.get('subtype')})")

asyncio.run(test_search())
