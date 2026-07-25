"""
Test marketplace + pricing tests.

Two things must hold:

  1. The advertised saving is real. Patient price is always MRP minus the
     partner's negotiated discount, and a missing or nonsensical discount shows
     no saving rather than an invented one.
  2. Only verified, listed partners can receive a patient's sample.
"""
import uuid

import pytest

import app.services.marketplace as marketplace_mod
from app.services.marketplace import MarketplaceService, PricingService

from tests.test_sample_lifecycle import FakeSupabase


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(marketplace_mod, "supabase", fake)
    return fake


def _seed_catalog(fake, name, slug, synonyms, category="lab_test", turnaround=6):
    cid = str(uuid.uuid4())
    fake.db.setdefault("service_catalog", []).append({
        "id": cid, "name": name, "slug": slug, "synonyms": synonyms,
        "category": category, "is_active": True,
        "typical_turnaround_hours": turnaround,
    })
    return cid


def _seed_provider(fake, name, city="Visakhapatnam", discount=0.0,
                   verified=True, listed=True, rating=5.0):
    pid = str(uuid.uuid4())
    fake.db.setdefault("provider_directory", []).append({
        "provider_user_id": pid, "display_name": name, "provider_type": "organization",
        "subtype": "diagnostic_center", "city": city, "state": "AP",
        "rating": rating,
        "verification_status": "verified" if verified else "pending",
        "is_listed": listed, "home_service_enabled": True,
    })
    fake.db.setdefault("provider_settings", []).append({
        "provider_user_id": pid, "partner_discount_pct": discount,
        "home_service_enabled": True, "is_listed": listed,
    })
    return pid


def _seed_service(fake, provider_id, catalog_id, name, mrp,
                  home=True, urgent=False, active=True):
    sid = str(uuid.uuid4())
    fake.db.setdefault("provider_services", []).append({
        "id": sid, "provider_user_id": provider_id, "catalog_id": catalog_id,
        "name": name, "mrp": mrp, "base_price": mrp, "home_available": home,
        "urgent_available": urgent, "is_active": active, "category": "lab_test",
    })
    return sid


def _seed_urgent_config(fake, **cfg):
    fake.db.setdefault("platform_settings", []).append({
        "key": "urgent_surcharge",
        "value": {"mode": "flat", "flat_inr": 200, "percent": 0,
                  "min_inr": 0, "max_inr": 1000, **cfg},
    })


# ── Pricing ──────────────────────────────────────────────────────────────────

def test_discount_produces_a_real_saving(fake_db):
    q = PricingService.quote(mrp=1000, discount_pct=25)
    assert q["mrp"] == 1000.0
    assert q["price"] == 750.0
    assert q["savings"] == 250.0
    assert q["payable"] == 750.0


def test_zero_discount_shows_no_saving(fake_db):
    q = PricingService.quote(mrp=499, discount_pct=0)
    assert q["price"] == 499.0 and q["savings"] == 0.0


@pytest.mark.parametrize("bad", [-10, 100, 150, None, "abc"])
def test_nonsensical_discount_is_treated_as_zero(fake_db, bad):
    """Never advertise a saving that was not negotiated, and never price at zero."""
    q = PricingService.quote(mrp=1000, discount_pct=bad)
    assert q["discount_pct"] == 0.0
    assert q["price"] == 1000.0
    assert q["savings"] == 0.0


def test_flat_urgent_surcharge(fake_db):
    _seed_urgent_config(fake_db, mode="flat", flat_inr=200)
    q = PricingService.quote(mrp=1000, discount_pct=20, urgent=True)
    assert q["price"] == 800.0
    assert q["urgent_surcharge"] == 200.0
    assert q["payable"] == 1000.0


def test_percent_urgent_surcharge_is_capped(fake_db):
    """A percentage surcharge on an MRI must not run away."""
    _seed_urgent_config(fake_db, mode="percent", percent=50, max_inr=1000)
    q = PricingService.quote(mrp=10000, discount_pct=0, urgent=True)
    assert q["urgent_surcharge"] == 1000.0     # 50% would be 5000, capped
    assert q["payable"] == 11000.0


def test_non_urgent_carries_no_surcharge(fake_db):
    _seed_urgent_config(fake_db, flat_inr=200)
    assert PricingService.quote(mrp=500, discount_pct=10)["urgent_surcharge"] == 0.0


# ── Catalogue search ─────────────────────────────────────────────────────────

def test_synonym_search_finds_the_canonical_test(fake_db):
    """'MRI' must find 'Magnetic Resonance Imaging'."""
    _seed_catalog(fake_db, "MRI", "mri", ["Magnetic Resonance Imaging", "MRI Scan"], "imaging")
    _seed_catalog(fake_db, "Complete Blood Count", "cbc", ["CBC", "Haemogram"])

    assert [t["slug"] for t in MarketplaceService.search_catalog("magnetic resonance")] == ["mri"]
    assert [t["slug"] for t in MarketplaceService.search_catalog("haemogram")] == ["cbc"]


def test_exact_match_outranks_substring(fake_db):
    """Searching 'MRI' should not bury MRI under a longer name containing it."""
    _seed_catalog(fake_db, "MRI", "mri", ["MRI Scan"], "imaging")
    _seed_catalog(fake_db, "Cardiac MRI With Contrast", "cardiac-mri", [], "imaging")

    assert MarketplaceService.search_catalog("mri")[0]["slug"] == "mri"


def test_search_is_case_insensitive(fake_db):
    _seed_catalog(fake_db, "HbA1c", "hba1c", ["Diabetes Test"])
    assert len(MarketplaceService.search_catalog("DIABETES test")) == 1


def test_unmatched_search_returns_nothing(fake_db):
    _seed_catalog(fake_db, "MRI", "mri", [], "imaging")
    assert MarketplaceService.search_catalog("dermatology") == []


# ── Offers ───────────────────────────────────────────────────────────────────

def test_offers_are_priced_and_sorted_cheapest_first(fake_db):
    cid = _seed_catalog(fake_db, "MRI", "mri", ["Magnetic Resonance Imaging"], "imaging", 24)
    cheap = _seed_provider(fake_db, "Vizag Scans", discount=30)
    dear = _seed_provider(fake_db, "Metro Imaging", discount=0)
    _seed_service(fake_db, cheap, cid, "MRI Brain", mrp=8000)
    _seed_service(fake_db, dear, cid, "MRI Brain", mrp=7000)

    result = MarketplaceService.find_offers(catalog_id=cid)
    offers = result["offers"]

    assert [o["provider_name"] for o in offers] == ["Vizag Scans", "Metro Imaging"]
    assert offers[0]["price"] == 5600.0 and offers[0]["savings"] == 2400.0
    assert offers[1]["price"] == 7000.0 and offers[1]["savings"] == 0.0


def test_unverified_partner_is_excluded(fake_db):
    """A patient handing over a sample must not be routed to an unvetted lab."""
    cid = _seed_catalog(fake_db, "CBC", "cbc", ["Haemogram"])
    good = _seed_provider(fake_db, "Verified Labs", discount=10)
    bad = _seed_provider(fake_db, "Pending Labs", discount=50, verified=False)
    _seed_service(fake_db, good, cid, "CBC", mrp=400)
    _seed_service(fake_db, bad, cid, "CBC", mrp=100)

    names = [o["provider_name"] for o in MarketplaceService.find_offers(catalog_id=cid)["offers"]]
    assert names == ["Verified Labs"]


def test_delisted_partner_is_excluded(fake_db):
    cid = _seed_catalog(fake_db, "CBC", "cbc", [])
    hidden = _seed_provider(fake_db, "Hidden Labs", listed=False)
    _seed_service(fake_db, hidden, cid, "CBC", mrp=400)
    assert MarketplaceService.find_offers(catalog_id=cid)["offers"] == []


def test_home_only_filter(fake_db):
    cid = _seed_catalog(fake_db, "CBC", "cbc", [])
    p1 = _seed_provider(fake_db, "Home Collect Labs")
    p2 = _seed_provider(fake_db, "Walk-in Only Labs")
    _seed_service(fake_db, p1, cid, "CBC", mrp=400, home=True)
    _seed_service(fake_db, p2, cid, "CBC", mrp=300, home=False)

    offers = MarketplaceService.find_offers(catalog_id=cid, home_only=True)["offers"]
    assert [o["provider_name"] for o in offers] == ["Home Collect Labs"]


def test_city_filter(fake_db):
    cid = _seed_catalog(fake_db, "CBC", "cbc", [])
    vizag = _seed_provider(fake_db, "Vizag Labs", city="Visakhapatnam")
    hyd = _seed_provider(fake_db, "Hyd Labs", city="Hyderabad")
    _seed_service(fake_db, vizag, cid, "CBC", mrp=400)
    _seed_service(fake_db, hyd, cid, "CBC", mrp=300)

    offers = MarketplaceService.find_offers(catalog_id=cid, city="Visakhapatnam")["offers"]
    assert [o["provider_name"] for o in offers] == ["Vizag Labs"]


def test_urgent_offers_carry_the_surcharge(fake_db):
    _seed_urgent_config(fake_db, mode="flat", flat_inr=200)
    cid = _seed_catalog(fake_db, "CBC", "cbc", [])
    p = _seed_provider(fake_db, "Vizag Labs", discount=20)
    _seed_service(fake_db, p, cid, "CBC", mrp=500, urgent=True)

    offer = MarketplaceService.find_offers(catalog_id=cid, urgent=True)["offers"][0]
    assert offer["price"] == 400.0
    assert offer["urgent_surcharge"] == 200.0
    assert offer["payable"] == 600.0


def test_inactive_service_is_excluded(fake_db):
    cid = _seed_catalog(fake_db, "CBC", "cbc", [])
    p = _seed_provider(fake_db, "Vizag Labs")
    _seed_service(fake_db, p, cid, "CBC", mrp=400, active=False)
    assert MarketplaceService.find_offers(catalog_id=cid)["offers"] == []


def test_partner_without_mrp_falls_back_to_base_price(fake_db):
    """Early partners who never entered an MRP must still be comparable."""
    cid = _seed_catalog(fake_db, "CBC", "cbc", [])
    p = _seed_provider(fake_db, "Legacy Labs", discount=10)
    fake_db.db.setdefault("provider_services", []).append({
        "id": str(uuid.uuid4()), "provider_user_id": p, "catalog_id": cid,
        "name": "CBC", "mrp": None, "base_price": 600,
        "home_available": True, "is_active": True,
    })

    offer = MarketplaceService.find_offers(catalog_id=cid)["offers"][0]
    assert offer["mrp"] == 600.0 and offer["price"] == 540.0


def test_search_by_query_resolves_the_test(fake_db):
    cid = _seed_catalog(fake_db, "MRI", "mri", ["Magnetic Resonance Imaging"], "imaging")
    p = _seed_provider(fake_db, "Vizag Scans", discount=25)
    _seed_service(fake_db, p, cid, "MRI Brain", mrp=8000)

    result = MarketplaceService.find_offers(query="magnetic resonance")
    assert result["test"]["slug"] == "mri"
    assert result["offers"][0]["payable"] == 6000.0


def test_offers_without_a_query_return_nothing(fake_db):
    assert MarketplaceService.find_offers()["offers"] == []


# ── Popular ──────────────────────────────────────────────────────────────────

def test_popular_ranks_by_partner_availability(fake_db):
    """The browse grid should show what is bookable, not a hardcoded wishlist."""
    common = _seed_catalog(fake_db, "CBC", "cbc", [])
    rare = _seed_catalog(fake_db, "Mammography", "mammography", [], "imaging")

    for i in range(3):
        p = _seed_provider(fake_db, f"Lab {i}")
        _seed_service(fake_db, p, common, "CBC", mrp=400)
    solo = _seed_provider(fake_db, "Solo Imaging")
    _seed_service(fake_db, solo, rare, "Mammography", mrp=2500)

    tests = MarketplaceService.popular_tests()
    assert tests[0]["slug"] == "cbc" and tests[0]["provider_count"] == 3
    assert tests[1]["slug"] == "mammography" and tests[1]["provider_count"] == 1
