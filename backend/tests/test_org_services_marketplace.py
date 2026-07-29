"""
Test org-services dual-write → marketplace visibility.

An organisation that adds a service in its dashboard writes to
organisation_services. The dual-write mirrors catalogue-matched services
into provider_services so the marketplace (find_offers) can find them.

Four things must hold:

  1. A catalogue-matched service ("MRI Brain") creates a provider_services
     row linked to the right catalogue entry, and the org appears in offers.
  2. A price update to an existing matched service re-writes base_price.
  3. An unmatched service name (e.g. a custom test that doesn't exist in
     service_catalog) skips the dual-write without failing the main write.
  4. Only verified, listed partners appear in offers.
"""
import uuid
import re

import pytest

import app.services.marketplace as marketplace_mod
from app.services.marketplace import MarketplaceService

from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(marketplace_mod, "supabase", fake)
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


def _seed_provider(fake, provider_user_id=None, name="DiagnoCentre",
                   city="Visakhapatnam", discount=0.0, verified=True):
    pid = provider_user_id or str(uuid.uuid4())
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


# ── Helper: simulate the dual-write logic from provider_management.py ────

def _simulate_dual_write(fake, provider_user_id, name, price, service_type="lab_test"):
    """Replicate the dual-write logic inline so tests dont need the router."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    catalog = fake.db.get("service_catalog", [])
    match = None
    for c in catalog:
        # Exact slug match
        if c.get("slug") == slug:
            match = c
            break
    # ILIKE fallback: catalog name is contained in the service name (or vice versa)
    if not match:
        needle = name.lower()
        for c in catalog:
            cn = c.get("name", "").lower()
            if needle in cn or cn in needle:
                match = c
                break
    if not match:
        return None  # unmatched — dual-write skipped

    cat_id = match["id"]
    existing = [
        s for s in fake.db.get("provider_services", [])
        if s.get("provider_user_id") == provider_user_id
        and s.get("catalog_id") == cat_id
    ]
    if existing:
        for s in existing:
            s["base_price"] = price
            s["mrp"] = price
        return existing[0]
    else:
        row = {
            "id": str(uuid.uuid4()),
            "provider_user_id": provider_user_id,
            "catalog_id": cat_id,
            "name": name,
            "category": service_type,
            "base_price": price,
            "mrp": price,
            "home_available": False,
            "is_active": True,
            "created_at": "2026-07-29T00:00:00Z",
        }
        fake.db.setdefault("provider_services", []).append(row)
        return row


# ── Tests ─────────────────────────────────────────────────────────────────

def test_catalog_matched_service_creates_provider_row(fake_db):
    """Org adds 'MRI Brain' (price 4500) → provider_services row exists."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain", ["MRI", "Brain MRI", "Magnetic Resonance Imaging Brain"])
    pid = _seed_provider(fake_db)

    result = _simulate_dual_write(fake_db, pid, "MRI Brain", 4500)
    assert result is not None, "dual-write should have matched"

    # Verify provider_services row was created
    services = [s for s in fake_db.db.get("provider_services", [])
                if s["provider_user_id"] == pid and s["catalog_id"] == cid]
    assert len(services) == 1
    assert services[0]["base_price"] == 4500
    assert services[0]["mrp"] == 4500
    assert services[0]["is_active"] is True


def test_matched_service_appears_in_offers(fake_db):
    """After dual-write, find_offers for that catalog returns the org."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain", ["MRI"])
    pid = _seed_provider(fake_db, name="Neuro Diagnostics")
    _seed_provider_service(fake_db, pid, cid, "MRI Brain", 4500)

    offers = MarketplaceService.find_offers(catalog_id=cid)
    assert offers["test"] is not None
    assert offers["test"]["id"] == cid
    assert len(offers["offers"]) == 1
    assert offers["offers"][0]["provider_user_id"] == pid
    assert offers["offers"][0]["provider_name"] == "Neuro Diagnostics"
    assert offers["offers"][0]["payable"] == 4500.0


def test_price_update_rewrites_base_price(fake_db):
    """Org updates price from 4500 → 4200 → base_price reflects latest."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain", ["MRI"])
    pid = _seed_provider(fake_db)

    _simulate_dual_write(fake_db, pid, "MRI Brain", 4500)
    _simulate_dual_write(fake_db, pid, "MRI Brain", 4200)

    services = [s for s in fake_db.db.get("provider_services", [])
                if s["provider_user_id"] == pid and s["catalog_id"] == cid]
    assert len(services) == 1
    assert services[0]["base_price"] == 4200
    assert services[0]["mrp"] == 4200

    # find_offers should reflect the updated price
    offers = MarketplaceService.find_offers(catalog_id=cid)
    assert len(offers["offers"]) == 1
    assert offers["offers"][0]["payable"] == 4200.0


def test_unmatched_service_skips_dual_write(fake_db):
    """A custom service not in service_catalog skips dual-write without error."""
    pid = _seed_provider(fake_db)

    # No matching catalog entry exists
    _seed_catalog(fake_db, "Complete Blood Count", "cbc", ["CBC"])

    result = _simulate_dual_write(fake_db, pid, "Zuks Custom Panel", 2999)
    assert result is None, "unmatched service should return None (skip)"

    # provider_services should have no row for this custom test
    services = fake_db.db.get("provider_services", [])
    assert len([s for s in services if s["name"] == "Zuks Custom Panel"]) == 0


def test_unverified_provider_excluded_from_offers(fake_db):
    """Unverified partner does not appear in find_offers even if dual-written."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain", ["MRI"])
    pid = _seed_provider(fake_db, name="Unverified Lab", verified=False)
    _seed_provider_service(fake_db, pid, cid, "MRI Brain", 3500)

    offers = MarketplaceService.find_offers(catalog_id=cid)
    # The unverified provider should be filtered out
    assert len(offers["offers"]) == 0, "unverified partner must not appear"


def test_slug_fallback_via_ilike_name(fake_db):
    """Dual-write matches by ILIKE name when slug differs from org's name."""
    cid = _seed_catalog(fake_db, "MRI Brain", "mri-brain", ["MRI"])
    pid = _seed_provider(fake_db)

    # The org enters "MRI Brain Screening" which slugifies to "mri-brain-screening"
    # but still contains "mri brain" → should match by ILIKE
    result = _simulate_dual_write(fake_db, pid, "MRI Brain Screening", 5000)
    assert result is not None, "should match via ILIKE fallback"
    assert result["catalog_id"] == cid
    assert result["base_price"] == 5000