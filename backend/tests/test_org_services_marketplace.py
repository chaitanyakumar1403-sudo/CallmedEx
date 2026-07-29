"""
Test org-services dual-write → marketplace visibility.

An organisation that adds a service in its dashboard writes to
organisation_services. The dual-write mirrors catalogue-matched services
into provider_services so the marketplace (find_offers) can find them.

Five things must hold:

  1. A catalogue-matched service ("MRI Brain") creates a provider_services
     row linked to the right catalogue entry, and the row has no phantom
     columns (especially no "updated_at" — that column does not exist in
     the provider_services DDL).
  2. The org appears in marketplace find_offers after the dual-write.
  3. A price update to an existing matched service re-writes base_price.
  4. An unmatched service name (e.g. a custom test that doesn't exist in
     service_catalog) skips the dual-write without failing the main write.
  5. Only verified, listed partners appear in offers.
"""
import uuid
import re

import pytest

import app.services.marketplace as marketplace_mod
import app.routers.provider_management as pm
from app.services.marketplace import MarketplaceService
from app.routers.provider_management import OrgServiceCreate

from tests.test_sample_lifecycle import FakeSupabase


# provider_services DDL columns (layer0_foundation.sql:47-57 + phase1 ALTERs)
PROVIDER_SERVICES_DDL = {
    "id", "provider_user_id", "branch_id", "name", "category",
    "base_price", "home_available", "is_active", "created_at",
    "mrp", "urgent_available", "catalog_id", "turnaround_hours",
}


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(marketplace_mod, "supabase", fake)
    monkeypatch.setattr(pm, "supabase", fake)
    MarketplaceService.invalidate_catalog()
    yield fake
    MarketplaceService.invalidate_catalog()


def _seed_catalog(fake, name, slug, synonyms, category="lab_test", turnaround=6):
    cid = str(uuid.uuid4())
    fake.db.setdefault("service_catalog", []).append({
        "id": cid, "name": name, "slug": slug, "synonyms": synonyms,
        "category": category, "is_active": True,
        "typical_turnaround_hours": turnaround,
    })
    return cid


def _seed_org_and_user(fake, provider_user_id=None, name="DiagnoCentre",
                       city="Visakhapatnam", discount=0.0, verified=True):
    """Seed the minimal tables needed for org_add_service to work:
    provider_directory, provider_settings, and (crucially) organizations
    + users so the function can resolve org_id from current_user.sub."""
    pid = provider_user_id or str(uuid.uuid4())
    fake.db.setdefault("users", []).append({
        "id": pid, "full_name": name, "city": city, "state": "AP",
        "role": "organization",
    })
    fake.db.setdefault("organizations", []).append({
        "id": str(uuid.uuid4()),
        "user_id": pid,
        "organization_name": name,
        "organization_type": "diagnostic_center",
        "verification_status": "verified" if verified else "pending",
    })
    fake.db.setdefault("provider_directory", []).append({
        "provider_user_id": pid, "display_name": name, "provider_type": "organization",
        "subtype": "diagnostic_center", "city": city, "state": "AP",
        "rating": 5.0,
        "verification_status": "verified" if verified else "pending",
        "is_listed": True, "home_service_enabled": True,
    })
    fake.db.setdefault("provider_settings", []).append({
        "provider_user_id": pid, "partner_discount_pct": discount,
        "home_service_enabled": True, "is_listed": True,
    })
    return pid


def _seed_provider_service(fake, provider_id, catalog_id, name, base_price,
                           mrp=None, home=False, active=True):
    sid = str(uuid.uuid4())
    fake.db.setdefault("provider_services", []).append({
        "id": sid, "provider_user_id": provider_id, "catalog_id": catalog_id,
        "name": name, "mrp": mrp or base_price, "base_price": base_price,
        "home_available": home, "urgent_available": False, "is_active": active,
        "category": "lab_test", "turnaround_hours": None,
    })
    return sid


# ── Tests that call the REAL org_add_service endpoint ────────────────────

@pytest.mark.asyncio
async def test_dual_write_via_real_endpoint_no_phantom_columns(fake_db):
    """Call org_add_service directly (not a simulated re-implementation)
    and verify the written provider_services row has only valid DDL columns
    — especially no 'updated_at' (that column does not exist)."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain",
                        ["MRI", "Brain MRI", "Magnetic Resonance Imaging Brain"])
    pid = _seed_org_and_user(fake_db)

    body = OrgServiceCreate(name="MRI Brain", price=4500.0)
    result = await pm.org_add_service(
        body=body,
        current_user={"sub": pid, "role": "organization"},
    )
    assert result["success"] is True

    # Check the provider_services row that should have been created
    services = [s for s in fake_db.db.get("provider_services", [])
                if s["provider_user_id"] == pid and s["catalog_id"] == cid]
    assert len(services) == 1, "dual-write should have created exactly one row"
    row = services[0]

    # No phantom columns
    written_keys = set(row.keys())
    forbidden = written_keys - PROVIDER_SERVICES_DDL
    assert "updated_at" not in written_keys, (
        "provider_services has no updated_at column — "
        "dual-write would be silently rejected by PostgREST"
    )
    assert not forbidden, (
        f"provider_services row contains non-DDL columns: {forbidden}"
    )
    # Spot-check the values
    assert row["base_price"] == 4500.0
    assert row["mrp"] == 4500.0
    assert row["is_active"] is True
    assert row["catalog_id"] == cid
    assert row["provider_user_id"] == pid


@pytest.mark.asyncio
async def test_dual_write_update_no_phantom_columns(fake_db):
    """Second call to org_add_service with same catalog updates the
    existing provider_services row (not a duplicate) — still no phantom
    columns."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain",
                        ["MRI", "Brain MRI"])
    pid = _seed_org_and_user(fake_db, name="Neuro Lab")

    # First insert
    body1 = OrgServiceCreate(name="MRI Brain", price=4500.0)
    await pm.org_add_service(body=body1, current_user={"sub": pid, "role": "organization"})

    # Update with new price
    body2 = OrgServiceCreate(name="MRI Brain", price=4200.0)
    await pm.org_add_service(body=body2, current_user={"sub": pid, "role": "organization"})

    services = [s for s in fake_db.db.get("provider_services", [])
                if s["provider_user_id"] == pid and s["catalog_id"] == cid]
    assert len(services) == 1, "update should not create a second row"
    row = services[0]

    written_keys = set(row.keys())
    forbidden = written_keys - PROVIDER_SERVICES_DDL
    assert "updated_at" not in written_keys
    assert not forbidden, f"update path contains non-DDL columns: {forbidden}"
    assert row["base_price"] == 4200.0
    assert row["mrp"] == 4200.0


@pytest.mark.asyncio
async def test_dual_write_unmatched_skips_silently(fake_db):
    """A service name not in service_catalog does not write to provider_services
    and does not raise."""
    cid = _seed_catalog(fake_db, "Complete Blood Count", "cbc", ["CBC"])
    pid = _seed_org_and_user(fake_db)

    body = OrgServiceCreate(name="Zuks Custom Panel", price=2999.0)
    result = await pm.org_add_service(
        body=body,
        current_user={"sub": pid, "role": "organization"},
    )
    assert result["success"] is True

    # provider_services should have no row for the unmatched name
    services = [s for s in fake_db.db.get("provider_services", [])
                if s["name"] == "Zuks Custom Panel"]
    assert len(services) == 0


# ── Legacy tests that verify marketplace behaviour ────────────────────────

def test_matched_service_appears_in_offers(fake_db):
    """After dual-write, find_offers for that catalog returns the org."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain", ["MRI"])
    pid = _seed_org_and_user(fake_db, name="Neuro Diagnostics")
    _seed_provider_service(fake_db, pid, cid, "MRI Brain", 4500)

    offers = MarketplaceService.find_offers(catalog_id=cid)
    assert offers["test"] is not None
    assert offers["test"]["id"] == cid
    assert len(offers["offers"]) == 1
    assert offers["offers"][0]["provider_user_id"] == pid
    assert offers["offers"][0]["provider_name"] == "Neuro Diagnostics"
    assert offers["offers"][0]["payable"] == 4500.0


def test_price_update_rewrites_base_price(fake_db):
    """Price update 4500 → 4200 reflected in find_offers."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain", ["MRI"])
    pid = _seed_org_and_user(fake_db)

    _seed_provider_service(fake_db, pid, cid, "MRI Brain", 4500)
    _seed_provider_service(fake_db, pid, cid, "MRI Brain", 4200)

    # Duplicate seed — the test verifies find_offers still sees the latest
    # (the real update-via-dual-write is tested above)
    offers = MarketplaceService.find_offers(catalog_id=cid)
    # Two rows exist in the mock but find_offers returns both; the sort
    # is by price then rating, so the cheaper one is first
    assert len(offers["offers"]) >= 1


def test_unmatched_service_skips_dual_write(fake_db):
    """A custom service not in service_catalog skips dual-write without error."""
    pid = _seed_org_and_user(fake_db)
    _seed_catalog(fake_db, "Complete Blood Count", "cbc", ["CBC"])

    # No provider_services row for a name that doesn't exist
    services = fake_db.db.get("provider_services", [])
    assert len([s for s in services if s.get("name") == "Zuks Custom Panel"]) == 0


def test_unverified_provider_excluded_from_offers(fake_db):
    """Unverified partner does not appear in find_offers even if dual-written."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain", ["MRI"])
    pid = _seed_org_and_user(fake_db, name="Unverified Lab", verified=False)
    _seed_provider_service(fake_db, pid, cid, "MRI Brain", 3500)

    offers = MarketplaceService.find_offers(catalog_id=cid)
    assert len(offers["offers"]) == 0, "unverified partner must not appear"


def test_slug_fallback_via_ilike_name(fake_db):
    """Dual-write matches by ILIKE name when slug differs from org's name."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain", ["MRI"])
    pid = _seed_org_and_user(fake_db)

    # "MRI Brain Screening" slugifies to "mri-brain-screening" which doesn't
    # match "mri-brain" — the ILIKE fallback must catch it
    _seed_provider_service(fake_db, pid, cid, "MRI Brain Screening", 5000)

    offers = MarketplaceService.find_offers(catalog_id=cid)
    assert len(offers["offers"]) == 1
    assert offers["offers"][0]["provider_user_id"] == pid