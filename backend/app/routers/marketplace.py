"""
Test Marketplace Router — CallMedex

Test-first discovery. Public by design: a patient must be able to compare
prices before creating an account, because forcing a signup to see a price is
exactly the friction that sends people back to walk-in labs.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Query

from app.services.marketplace import MarketplaceService, PricingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/marketplace", tags=["Marketplace"])


@router.get("/tests/search")
async def search_tests(
    q: Optional[str] = Query(None, description="Service name or common synonym"),
    category: Optional[str] = Query(None, description="lab_test | imaging | dental | physiotherapy | procedure"),
    limit: int = Query(20, le=250),
):
    """
    Match a search term against canonical service names and their synonyms.

    With `category` and no query this returns the whole category alphabetically,
    which is how a patient browses dental or physiotherapy without knowing the
    exact name of the procedure they need.
    """
    return {
        "success": True,
        "query": q or "",
        "category": category or "",
        "tests": MarketplaceService.search_catalog(q or "", limit=limit, category=category),
    }


@router.get("/tests/popular")
async def popular_tests(limit: int = Query(12, le=40)):
    """Browse grid for an empty search, ranked by how many partners offer each test."""
    return {"success": True, "tests": MarketplaceService.popular_tests(limit=limit)}


@router.get("/offers")
async def find_offers(
    catalog_id: Optional[str] = None,
    q: Optional[str] = None,
    city: Optional[str] = None,
    home_only: bool = False,
    urgent: bool = False,
    limit: int = Query(40, le=100),
):
    """
    Every verified partner offering a test, priced for comparison.

    Each offer carries the partner's MRP alongside the CallMedex price, so the
    saving shown to the patient is attributable rather than a marketing claim.
    """
    if not catalog_id and not q:
        return {"success": True, "test": None, "offers": [], "total": 0}

    result = MarketplaceService.find_offers(
        catalog_id=catalog_id, query=q, city=city,
        home_only=home_only, urgent=urgent, limit=limit,
    )
    return {"success": True, **result}


@router.get("/fulfilment")
async def find_fulfilment(
    catalog_id: Optional[str] = None,
    q: Optional[str] = None,
    city: Optional[str] = None,
    home: bool = False,
    urgent: bool = False,
):
    """
    One CallMedex fulfilment option for a test — partner-blind by design.

    A blood test booked through CallMedex is between CallMedex and the
    patient only. Which partner centre actually fulfils it is an internal
    allocation, recorded on the booking so dispatch/samples/settlement keep
    working, but never surfaced here — no partner name, id, rating or
    address. `partner_count` is the one coverage signal that is safe to show
    ("3 partner labs in your area") because it does not identify anyone.

    Returns test=None, fulfilment=None when nothing covers the search, so the
    frontend can say so honestly rather than inventing a price.
    """
    if not catalog_id and not q:
        return {"success": True, "test": None, "fulfilment": None}

    result = MarketplaceService.select_fulfilment(
        catalog_id=catalog_id, query=q, city=city, home=home, urgent=urgent,
    )
    if not result:
        return {"success": True, "test": None, "fulfilment": None}

    # Built explicitly, never spread — result also carries an internal
    # provider_user_id that must not reach the patient.
    return {"success": True, "test": result["test"], "fulfilment": result["fulfilment"]}


@router.get("/offers/featured")
async def featured_offers(
    city: Optional[str] = None,
    limit: int = Query(12, le=40),
):
    """
    Health packages and discounted services from verified partners.

    Public: a patient should be able to see what is on offer before creating an
    account. Returns empty lists rather than an error when no partner has
    published anything, so the caller can render an honest empty state.
    """
    return {"success": True, **MarketplaceService.offers_feed(city=city, limit=limit)}


@router.get("/pricing/urgent")
async def urgent_pricing(base_price: float = Query(0, ge=0)):
    """What a priority booking adds at this price point — shown before committing."""
    return {
        "success": True,
        "config": PricingService.urgent_surcharge_config(),
        "surcharge": PricingService.urgent_surcharge_for(base_price),
    }


@router.get("/radiology/services")
async def get_radiology_services(city: Optional[str] = Query(None, description="Patient's city")):
    """
    Returns canonical radiology & diagnostic imaging services (X-Ray, Spine X-Ray,
    ECG, PFT, Audiometry) with diagnostic centers offering each test and their respective prices.
    """
    services = MarketplaceService.radiology_services_with_offers(city=city)
    return {
        "success": True,
        "total": len(services),
        "city": city or "All Locations",
        "services": services,
    }

