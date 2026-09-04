"""
Test Marketplace Service — CallMedex

Turns a patient's search term into bookable, comparably-priced offers.

The entry point is the TEST, not the centre. A patient searching "MRI" does not
care which lab they end up at; they care what it costs, how far it is and when
they can be seen. Searching by centre first — the model most Indian healthtech
marketplaces use — forces the patient to already know the answer.

Pricing model (confirmed with the owner):
    the partner sets MRP (their walk-in rate)
    CallMedex sets a negotiated discount % per partner
    patient price = MRP x (1 - discount%)

so the patient sees a struck-through MRP against the CallMedex price, and the
saving is a real, attributable number rather than a marketing claim.

Urgent bookings add a platform-wide surcharge on top, configured in
platform_settings so operations can tune it without a deploy.
"""
import logging
import time
import uuid
from typing import List, Optional

from app.database import supabase

logger = logging.getLogger(__name__)

EARTH_KM = 6371.0


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


def _is_uuid(value) -> bool:
    """True when value can drive a filter on a UUID column.

    PostgREST answers a UUID column filtered by free text with a 400, and the
    client raises — so callers must check before passing patient-supplied
    strings (package names, search phrases) into .eq() on a UUID column.
    """
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def _first(result) -> dict:
    rows = _rows(result)
    return rows[0] if rows else {}


def _num(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


class PricingService:
    """Patient-facing price derivation. Single source of truth for what is charged."""

    @staticmethod
    def urgent_surcharge_config() -> dict:
        """
        Urgent pricing config.

        The owner has confirmed that priority booking carries an extra charge and
        ranks first in dispatch, but the AMOUNT is not yet agreed. `confirmed` is
        therefore false by default and no rupee figure is invented: quoting a
        made-up surcharge to a patient would be a price we cannot stand behind.
        Setting a real amount and flipping `confirmed` turns it on with no code
        change. Priority ordering is unaffected either way — urgent still sorts
        first whether or not it is priced.
        """
        default = {
            "mode": "flat", "flat_inr": 0, "percent": 0,
            "min_inr": 0, "max_inr": 0, "confirmed": False,
        }
        if not supabase:
            return default
        try:
            row = _first(
                supabase.table("platform_settings")
                .select("value").eq("key", "urgent_surcharge").limit(1).execute()
            )
            return {**default, **(row.get("value") or {})}
        except Exception:
            return default

    @staticmethod
    def urgent_surcharge_for(base_price: float) -> float:
        """Rupee surcharge for a priority booking, or 0 until the rate is agreed."""
        cfg = PricingService.urgent_surcharge_config()
        if not cfg.get("confirmed"):
            return 0.0

        if cfg.get("mode") == "percent":
            amount = base_price * _num(cfg.get("percent")) / 100.0
        else:
            amount = _num(cfg.get("flat_inr"))

        lo, hi = _num(cfg.get("min_inr")), _num(cfg.get("max_inr"))
        if hi > 0:
            amount = min(amount, hi)
        return round(max(amount, lo), 2)

    @staticmethod
    def platform_fee_pct() -> float:
        """The platform fee every partner MOU fixes at 20%."""
        if not supabase:
            return 20.0
        try:
            row = _first(
                supabase.table("platform_settings")
                .select("value").eq("key", "default_platform_fee_pct").limit(1).execute()
            )
            value = row.get("value") or {}
            return _num(value.get("percent"), 20.0)
        except Exception:
            return 20.0

    @staticmethod
    def quote(
        mrp: float,
        discount_pct: float,
        urgent: bool = False,
        platform_fee_pct: Optional[float] = None,
    ) -> dict:
        """
        Price one service.

        Every partner MOU fixes the same commercial split, and fixes it against
        the sum the patient actually hands over:

            100 rupees paid  ->  80 to the provider, 20 to CallMedex.

        The wording is explicit in the agreements — "a platform service fee of
        20% on the gross consultation fee paid by the patient" (DOCTOR), "20% on
        the gross billing amount paid by the client" (Nursing), "Platform Fee
        (20%) / Provider Share (80%)" (Dietetic tariff sheet) — and holds for
        doctors, dental, dietitians, nursing, physiotherapy, diagnostic centres
        and ECG/X-ray alike. Phlebotomists are the one exception: they are
        engaged per verified collection or salaried, never on a percentage.

        So the base of the split is `price`, what the patient pays, not MRP. An
        advertised discount lowers both shares in proportion; it is not funded
        out of the platform fee alone. This is a deliberate departure from the
        earlier reading of dental MOU §3.3 ("shall not be required to bear any
        additional discount"), which paid the partner 80% of MRP and left
        CallMedex with nothing whenever a full discount ran.

        The urgent surcharge is CallMedex's charge for priority dispatch rather
        than part of the service rendered, so it is excluded from the split and
        added to `payable` on its own.
        """
        mrp = round(max(_num(mrp), 0.0), 2)
        fee_pct = _num(platform_fee_pct, PricingService.platform_fee_pct())

        pct = _num(discount_pct)
        if pct < 0 or pct >= 100:
            pct = 0.0
        # A ceiling on how deep any advertised discount may go. It is no longer
        # a solvency limit — the split below stays whole at any discount — but
        # a policy guardrail so a mis-keyed percentage cannot halve a partner's
        # rate platform-wide.
        capped = min(pct, fee_pct)

        price = round(mrp * (1 - capped / 100.0), 2)
        savings = round(mrp - price, 2)

        # The fee is 20% of what the patient actually pays: 100 rupees in means
        # 80 to the provider and 20 to CallMedex. Every MOU words it that way —
        # "20% on the gross consultation fee paid by the patient" (doctors),
        # "on the gross billing amount paid by the client" (nursing).
        #
        # This used to pay 80% of MRP instead, so the whole of any discount came
        # out of CallMedex's share: at a 20% discount the platform retained
        # nothing at all, and the payout quoted to a partner here disagreed with
        # what payment.py actually credited them, which is 20% of the sum
        # captured. Both now compute the same number from the same base.
        provider_payout = round(price * (1 - fee_pct / 100.0), 2)
        platform_retained = round(price - provider_payout, 2)

        # The priority surcharge is CallMedex's own charge for jumping the
        # dispatch queue, not part of the service the provider renders, so it
        # sits outside the split and is added to `payable` alone.
        surcharge = PricingService.urgent_surcharge_for(price) if urgent else 0.0

        return {
            "mrp": mrp,
            "discount_pct": round(capped, 2),
            "requested_discount_pct": round(pct, 2),
            "price": price,
            "savings": savings,
            "platform_fee_pct": round(fee_pct, 2),
            "provider_payout": provider_payout,
            "platform_retained": platform_retained,
            "urgent_surcharge": surcharge,
            "payable": round(price + surcharge, 2),
        }


from app.services.diagnostic_canonical_list import CANONICAL_RADIOLOGY_SERVICES



class MarketplaceService:
    """Test-first discovery across partner centres."""

    # Catalogue is platform-owned reference data: ~900 rows that change when a
    # master sheet is loaded, not per request. Caching it turns a per-keystroke
    # query into one fetch per TTL, and — more importantly — lets the search scan
    # the WHOLE catalogue. A bounded .limit() silently hid every dental and
    # physiotherapy service, because they sort after the 487 lab tests.
    _catalog_cache: List[dict] = []
    _catalog_cached_at: float = 0.0
    _CATALOG_TTL_SECONDS = 300

    @staticmethod
    def invalidate_catalog() -> None:
        """
        Drop the cached catalogue.

        Needed after a master-data load so new services appear immediately
        rather than up to the TTL later, and so tests do not leak one fixture's
        catalogue into the next.
        """
        MarketplaceService._catalog_cache = []
        MarketplaceService._catalog_cached_at = 0.0

    @staticmethod
    def _load_catalog(force: bool = False) -> List[dict]:
        now = time.time()
        if (not force and MarketplaceService._catalog_cache
                and now - MarketplaceService._catalog_cached_at < MarketplaceService._CATALOG_TTL_SECONDS):
            return MarketplaceService._catalog_cache

        rows: List[dict] = []
        if supabase:
            page, size = 0, 1000
            try:
                # Paged so the catalogue can outgrow PostgREST's default cap without
                # quietly truncating results again.
                while True:
                    batch = _rows(
                        supabase.table("service_catalog")
                        .select("*").eq("is_active", True)
                        .range(page * size, page * size + size - 1)
                        .execute()
                    )
                    rows.extend(batch)
                    if len(batch) < size:
                        break
                    page += 1
            except Exception as e:
                logger.error(f"catalog load failed: {e}")
                rows = list(MarketplaceService._catalog_cache or [])

        # Seamlessly merge canonical radiology master services if not present in DB
        existing_slugs = {str(r.get("slug", "")).lower() for r in rows}
        existing_names = {str(r.get("name", "")).lower() for r in rows}
        for cr in CANONICAL_RADIOLOGY_SERVICES:
            if cr["slug"].lower() not in existing_slugs and cr["name"].lower() not in existing_names:
                rows.append(dict(cr))

        MarketplaceService._catalog_cache = rows
        MarketplaceService._catalog_cached_at = now
        return rows

    # ── Catalogue search ──────────────────────────────────────────────────

    @staticmethod
    def search_catalog(query: str, limit: int = 20, category: Optional[str] = None) -> list:
        """
        Match a search term against canonical test names AND their synonyms.

        Synonyms are why "MRI" finds "Magnetic Resonance Imaging" and "sugar
        test" finds "Fasting Blood Sugar" — patients search in the words they
        use, not the words a lab prints on a requisition.
        """
        if not supabase:
            return []
        q = (query or "").strip().lower()
        catalog = MarketplaceService._load_catalog()
        if category:
            catalog = [c for c in catalog if c.get("category") == category]

        if not q:
            # Browsing a category: alphabetical is what a patient can scan.
            return sorted(catalog, key=lambda c: str(c.get("name", "")).lower())[:limit]

        scored = []
        for entry in catalog:
            name = str(entry.get("name", "")).lower()
            synonyms = [str(s).lower() for s in (entry.get("synonyms") or [])]

            # Rank exact over prefix over substring, so "MRI" puts MRI first
            # rather than burying it under "Mammography".
            if name == q or q in synonyms:
                score = 0
            elif name.startswith(q) or any(s.startswith(q) for s in synonyms):
                score = 1
            elif q in name or any(q in s for s in synonyms):
                score = 2
            else:
                continue
            scored.append((score, name, entry))

        scored.sort(key=lambda t: (t[0], t[1]))
        return [e for _, _, e in scored[:limit]]

    # ── Offers ────────────────────────────────────────────────────────────

    @staticmethod
    def _provider_index(provider_ids: List[str]) -> dict:
        """Directory rows and discount settings for a set of providers, in bulk."""
        if not supabase or not provider_ids:
            return {}

        directory, settings = {}, {}
        try:
            for row in _rows(
                supabase.table("provider_directory")
                .select("*")
                .in_("provider_user_id", provider_ids)
                .execute()
            ):
                directory[row["provider_user_id"]] = row
        except Exception as e:
            logger.error(f"provider directory read failed: {e}")

        try:
            for row in _rows(
                supabase.table("provider_settings")
                .select("provider_user_id, partner_discount_pct, home_service_enabled, is_listed")
                .in_("provider_user_id", provider_ids)
                .execute()
            ):
                settings[row["provider_user_id"]] = row
        except Exception as e:
            logger.error(f"provider settings read failed: {e}")

        return {pid: {**directory.get(pid, {}), **settings.get(pid, {})} for pid in provider_ids}

    @staticmethod
    def find_offers(
        catalog_id: Optional[str] = None,
        query: Optional[str] = None,
        city: Optional[str] = None,
        home_only: bool = False,
        urgent: bool = False,
        limit: int = 40,
    ) -> dict:
        """
        Every partner offering a given test, priced for comparison.

        Matching is by catalogue link first, falling back to a name match so a
        partner who has not yet mapped their service to the catalogue still
        appears. Unverified or unlisted partners are excluded — the patient is
        being asked to hand over a blood sample, so an unvetted lab has no place
        in the results.
        """
        if not supabase:
            return {"test": None, "offers": []}

        test = None
        if catalog_id:
            # catalog_id arrives as either a real service_catalog UUID (deep
            # link from /diagnostics) or free text (a health-package name or
            # search phrase from the generic picker). Only a UUID may hit the
            # id column — free text makes PostgREST 400, and the raised
            # exception used to abort the whole lookup before the
            # processing-centre fallback could offer the test at all.
            if _is_uuid(catalog_id):
                try:
                    test = _first(
                        supabase.table("service_catalog").select("*").eq("id", catalog_id).limit(1).execute()
                    )
                except Exception:
                    test = None
            if not test:
                matches = MarketplaceService.search_catalog(catalog_id, limit=1)
                test = matches[0] if matches else None
        elif query:
            matches = MarketplaceService.search_catalog(query, limit=1)
            test = matches[0] if matches else None

        # Synthesize a fallback test object if catalog_id or query was supplied but not found in DB
        if not test and (catalog_id or query):
            test_title = str(catalog_id or query or "Lab Test").strip()
            test = {
                "id": catalog_id or query or "cat-default",
                "name": test_title,
                "mrp": 599.0,
                "typical_turnaround_hours": 24,
                "preparation": "Standard lab preparation",
            }

        services: List[dict] = []
        if not test:
            # No specific test requested — every active partner service.
            try:
                services = _rows(
                    supabase.table("provider_services").select("*")
                    .eq("is_active", True).limit(400).execute()
                )
            except Exception as e:
                logger.error(f"find_offers services read failed: {e}")
        elif _is_uuid(test.get("id")):
            try:
                services = _rows(
                    supabase.table("provider_services").select("*")
                    .eq("is_active", True).eq("catalog_id", test["id"])
                    .limit(400).execute()
                )
            except Exception as e:
                # A failed partner-services read must not end the booking —
                # fall through to the name match and the processing-centre
                # fallback instead of returning an empty offer list.
                logger.error(f"find_offers services read failed: {e}")
        # else: synthesized test with a free-text id — no catalog row exists,
        # so no provider_service can be linked to it. Skip straight to the
        # name fallback; filtering the UUID column by it would 400.

        # Fall back to name matching for partners who have not mapped their
        # catalogue yet, so early-onboarded centres are not invisible.
        if test and not services:
            needle = str(test.get("name", "")).lower()
            aliases = [needle] + [str(s).lower() for s in (test.get("synonyms") or [])]
            try:
                every = _rows(
                    supabase.table("provider_services")
                    .select("*").eq("is_active", True).limit(400).execute()
                )
            except Exception:
                every = []
            services = [
                s for s in every
                if any(a in str(s.get("name", "")).lower() for a in aliases)
            ]

        if home_only:
            services = [s for s in services if s.get("home_available")]

        index = MarketplaceService._provider_index(
            list({s["provider_user_id"] for s in services})
        )

        offers = []
        for svc in services:
            provider = index.get(svc["provider_user_id"]) or {}

            # A patient handing over a blood sample must not be routed to an
            # unvetted or delisted partner.
            if provider.get("verification_status") != "verified":
                continue
            if provider.get("is_listed") is False:
                continue
            if city and city.strip().lower() not in (
                f"{provider.get('city', '')} {provider.get('state', '')}".lower()
            ):
                continue

            # Partners who have not entered an MRP yet: treat base_price as MRP
            # so they are still comparable, just with no advertised saving.
            mrp = _num(svc.get("mrp")) or _num(svc.get("base_price"))
            pricing = PricingService.quote(
                mrp, _num(provider.get("partner_discount_pct")), urgent=urgent
            )

            offers.append({
                "service_id": svc["id"],
                "service_name": svc.get("name"),
                "provider_user_id": svc["provider_user_id"],
                "provider_name": provider.get("display_name") or "Partner centre",
                "provider_type": provider.get("subtype") or provider.get("provider_type"),
                "city": provider.get("city", ""),
                "state": provider.get("state", ""),
                # None, not 5.0. Defaulting an unrated partner to a perfect
                # score put a five-star badge on a centre nobody has reviewed.
                "rating": provider.get("rating"),
                "home_available": bool(svc.get("home_available")),
                "urgent_available": bool(svc.get("urgent_available")),
                "turnaround_hours": svc.get("turnaround_hours") or (
                    test.get("typical_turnaround_hours") if test else None
                ),
                **pricing,
            })

        # ── Processing Center area-based fallback ──────────────────────────
        # When no partner lab offers this test in the patient's city, check if
        # any Processing Center (PC) has a service area or primary location covering that city.
        # PCs are logistics hubs that dispatch phlebotomists to collect samples —
        # they serve ANY catalog test at the catalog's fixed MRP.
        if test:
            city_lower = (city or "").strip().lower()
            try:
                # Fetch active and onboarding PCs (not paused)
                pcs = _rows(
                    supabase.table("processing_centers")
                    .select("id, name, city, state, status")
                    .neq("status", "paused")
                    .execute()
                )
                if pcs:
                    pc_map = {pc["id"]: pc for pc in pcs}
                    # Fetch active service areas for these PCs from processing_center_areas table
                    areas = _rows(
                        supabase.table("processing_center_areas")
                        .select("processing_center_id, city, pincode, radius_km, is_active")
                        .eq("is_active", True)
                        .in_("processing_center_id", list(pc_map.keys()))
                        .execute()
                    )
                    
                    matching_pc_ids = set()
                    
                    if city_lower:
                        # Match by registered service areas
                        for area in areas:
                            area_city = str(area.get("city", "")).strip().lower()
                            if area_city and (area_city in city_lower or city_lower in area_city):
                                matching_pc_ids.add(area.get("processing_center_id"))
                        
                        # Match by PC's main location city
                        for pc_id, pc in pc_map.items():
                            pc_city = str(pc.get("city", "")).strip().lower()
                            if pc_city and (pc_city in city_lower or city_lower in pc_city):
                                matching_pc_ids.add(pc_id)

                    # If no specific city matched or city was not provided, fallback to ALL active PCs!
                    if not matching_pc_ids:
                        matching_pc_ids = set(pc_map.keys())

                    for pc_id in matching_pc_ids:
                        pc = pc_map.get(pc_id)
                        if not pc:
                            continue

                        # Check if this exact PC offer is already added
                        pc_svc_id = f"pc_{pc['id']}_{test['id']}"
                        already_has = any(o.get("service_id") == pc_svc_id for o in offers)
                        if already_has:
                            continue

                        # Lab tests and health packages are priced by CallMedex,
                        # not by the centre: the patient books at the platform
                        # rate, a phlebotomist collects, and the sample goes to
                        # whichever partner centre works for CallMedex. That
                        # fixed rate lives on service_catalog as reference_mrp /
                        # reference_offer_price (database/catalog_master_data.sql).
                        #
                        # This read `test.get("mrp")`, which no service_catalog
                        # row has -- _load_catalog does select("*") and the
                        # column is called reference_mrp. So every real test
                        # missed and fell through to a hardcoded 599, which is
                        # what the patient was quoted and what create-order then
                        # billed, whatever CallMedex had actually fixed.
                        mrp = (
                            _num(test.get("reference_mrp"))
                            or _num(test.get("mrp"))
                            or _num(test.get("base_price", 0))
                        )
                        if mrp <= 0:
                            # Nothing priced this test. A made-up figure would
                            # commit the patient to a number nobody set, so the
                            # offer is withheld instead.
                            logger.warning(
                                "PC fallback skipped for %s: no CallMedex price on record",
                                test.get("id"),
                            )
                            continue

                        # reference_offer_price is the fixed price CallMedex
                        # advertises; the gap to reference_mrp is the real,
                        # platform-set saving rather than an invented one.
                        offer_price = _num(test.get("reference_offer_price"))
                        fixed_discount_pct = (
                            round((mrp - offer_price) / mrp * 100, 2)
                            if 0 < offer_price < mrp else 0.0
                        )
                        pricing = PricingService.quote(
                            mrp, fixed_discount_pct, urgent=urgent
                        )
                        offers.append({
                            "service_id": pc_svc_id,
                            "service_name": test.get("name"),
                            "provider_user_id": pc["id"],
                            "provider_name": pc.get("name", "CallMedex Processing Centre"),
                            "provider_type": "processing_center",
                            "city": pc.get("city", ""),
                            "state": pc.get("state", ""),
                            "rating": None,
                            "home_available": True,
                            "urgent_available": True,
                            "turnaround_hours": test.get("typical_turnaround_hours"),
                            "is_pc_fulfilled": True,
                            **pricing,
                        })
            except Exception as e:
                logger.error(f"PC area fallback failed: {e}")

        # Cheapest first: price is the comparison the patient actually came for.
        offers.sort(key=lambda o: (o["payable"], -(o["rating"] or 0.0)))

        return {
            "test": test,
            "offers": offers[:limit],
            "total": len(offers),
            "urgent": urgent,
        }

    # ── Fulfilment (partner-blind) ───────────────────────────────────────

    @staticmethod
    def select_fulfilment(
        catalog_id: Optional[str] = None,
        query: Optional[str] = None,
        city: Optional[str] = None,
        home: bool = False,
        urgent: bool = False,
    ) -> Optional[dict]:
        """
        One CallMedex fulfilment option for a test — never a list of partners.

        Blood tests are between CallMedex and the patient only; which partner
        centre CallMedex routes the sample to internally is never shown (see
        CLAUDE.md — partner-blind diagnostics booking is the core positioning).
        This reuses `find_offers`' matching/pricing/verification and then
        picks internally: home-capable partners first when home collection
        was requested, then lowest patient price, then rating, then fastest
        turnaround.

        `walk_in_required` reflects whether ANY verified partner in this city
        can do the test at home — not just the one selected — because that is
        the honest answer to "can I avoid a walk-in visit here at all",
        independent of which specific partner ends up winning this booking.

        Returns None when no verified partner covers the test/city at all, so
        the caller can say so honestly rather than fabricating an allocation.
        """
        result = MarketplaceService.find_offers(
            catalog_id=catalog_id, query=query, city=city,
            home_only=False, urgent=urgent, limit=200,
        )
        test = result.get("test")
        offers = result.get("offers") or []
        if not test or not offers:
            return None

        partner_count = len({o["provider_user_id"] for o in offers})
        home_capable = [o for o in offers if o.get("home_available")]
        walk_in_required = len(home_capable) == 0

        candidates = home_capable if (home and home_capable) else offers
        chosen = sorted(
            candidates,
            key=lambda o: (o["payable"], -(o["rating"] or 0.0), o.get("turnaround_hours") or 9999),
        )[0]

        return {
            "test": {
                "id": test.get("id"),
                "name": test.get("name"),
                "preparation": test.get("preparation") or "",
                "turnaround_hours": test.get("typical_turnaround_hours"),
            },
            "fulfilment": {
                "price": chosen["price"],
                "mrp": chosen["mrp"],
                "savings": chosen["savings"],
                "home_available": bool(chosen.get("home_available")),
                "walk_in_required": walk_in_required,
                "urgent_available": bool(chosen.get("urgent_available")),
                "urgent_surcharge": chosen.get("urgent_surcharge", 0.0),
                "partner_count": partner_count,
            },
            # Internal only. The bookings router uses this to resolve
            # provider_id server-side; nothing else may read this key, and it
            # must never be spread into a response the patient can see.
            "provider_user_id": chosen["provider_user_id"],
            "provider_type": chosen.get("provider_type", "organization"),
        }

    # ── Offers feed ───────────────────────────────────────────────────────

    @staticmethod
    def offers_feed(city: Optional[str] = None, limit: int = 12) -> dict:
        """
        What partners are actively offering right now: health packages, and any
        service carrying a real negotiated discount.

        Only verified, listed partners appear, and every price runs through
        PricingService so a package is quoted on the same terms as anything else
        — the partner still takes their 80% and the discount still comes out of
        the platform fee. A package that quietly used different arithmetic would
        be the easiest place for the MOU split to drift.
        """
        if not supabase:
            return {"packages": [], "discounted": []}

        packages, discounted = [], []

        try:
            rows = _rows(
                supabase.table("provider_packages")
                .select("*")
                .eq("is_active", True).eq("status", "approved")
                .limit(200).execute()
            )
        except Exception as e:
            logger.error(f"offers_feed packages read failed: {e}")
            rows = []

        # Legacy organization_packages predates provider_packages; include it so
        # partners who entered packages on the older screen are not invisible.
        try:
            for r in _rows(
                supabase.table("organization_packages")
                .select("*").eq("is_active", True).limit(200).execute()
            ):
                rows.append({
                    "id": r.get("id"),
                    "provider_user_id": r.get("organization_id"),
                    "name": r.get("name"),
                    "description": r.get("description"),
                    "price": r.get("price"),
                    "included_service_ids": [],
                })
        except Exception:
            pass

        index = MarketplaceService._provider_index(
            list({r["provider_user_id"] for r in rows if r.get("provider_user_id")})
        )

        for pkg in rows:
            provider = index.get(pkg.get("provider_user_id")) or {}
            if provider.get("verification_status") != "verified":
                continue
            if provider.get("is_listed") is False:
                continue
            if city and city.strip().lower() not in (
                f"{provider.get('city', '')} {provider.get('state', '')}".lower()
            ):
                continue

            pricing = PricingService.quote(
                _num(pkg.get("price")), _num(provider.get("partner_discount_pct"))
            )
            packages.append({
                "id": pkg.get("id"),
                "name": pkg.get("name"),
                "description": pkg.get("description") or "",
                "provider_user_id": pkg.get("provider_user_id"),
                "provider_name": provider.get("display_name") or "Partner centre",
                "city": provider.get("city", ""),
                "test_count": len(pkg.get("included_service_ids") or []),
                **pricing,
            })

        # Individual services a partner is genuinely discounting.
        try:
            discount_rows = _rows(
                supabase.table("provider_settings")
                .select("provider_user_id, partner_discount_pct")
                .gt("partner_discount_pct", 0).limit(100).execute()
            )
        except Exception:
            discount_rows = []

        if discount_rows:
            by_provider = {d["provider_user_id"]: _num(d.get("partner_discount_pct"))
                           for d in discount_rows}
            svc_index = MarketplaceService._provider_index(list(by_provider))
            try:
                svcs = _rows(
                    supabase.table("provider_services")
                    .select("*").eq("is_active", True)
                    .in_("provider_user_id", list(by_provider))
                    .limit(200).execute()
                )
            except Exception:
                svcs = []
            for svc in svcs:
                provider = svc_index.get(svc["provider_user_id"]) or {}
                if provider.get("verification_status") != "verified":
                    continue
                if provider.get("is_listed") is False:
                    continue
                mrp = _num(svc.get("mrp")) or _num(svc.get("base_price"))
                pricing = PricingService.quote(mrp, by_provider[svc["provider_user_id"]])
                if pricing["savings"] <= 0:
                    continue
                discounted.append({
                    "service_id": svc["id"],
                    "name": svc.get("name"),
                    "provider_user_id": svc["provider_user_id"],
                    "provider_name": provider.get("display_name") or "Partner centre",
                    "city": provider.get("city", ""),
                    "home_available": bool(svc.get("home_available")),
                    **pricing,
                })

        packages.sort(key=lambda p: -p["savings"])
        discounted.sort(key=lambda d: -d["savings"])
        return {"packages": packages[:limit], "discounted": discounted[:limit]}

    # ── Popular / browse ──────────────────────────────────────────────────

    @staticmethod
    def popular_tests(limit: int = 12) -> list:
        """
        Browse list for an empty search box.

        Ordered by how many partners actually offer each test, so the landing
        grid shows what is genuinely bookable rather than a hardcoded wishlist.
        """
        if not supabase:
            return []
        catalog = [dict(c) for c in MarketplaceService._load_catalog()]
        try:
            services = _rows(
                supabase.table("provider_services")
                .select("catalog_id").eq("is_active", True).limit(2000).execute()
            )
        except Exception as e:
            logger.error(f"popular_tests failed: {e}")
            return []

        counts: dict = {}
        for s in services:
            cid = s.get("catalog_id")
            if cid:
                counts[cid] = counts.get(cid, 0) + 1

        for entry in catalog:
            entry["provider_count"] = counts.get(entry["id"], 0)

        catalog.sort(key=lambda e: (-e["provider_count"], e.get("name", "")))
        return catalog[:limit]

    # ── Radiology & Imaging with Diagnostic Center Pricing ────────────────

    @staticmethod
    def radiology_services_with_offers(city: Optional[str] = None) -> List[dict]:
        """Canonical imaging services, each with the centres that genuinely offer it.

        Everything a patient reads on this screen is attributed to a named, real
        business, so every field has to come from a record someone actually
        entered. The previous version manufactured most of it:

          * `rating: 4.9 if verified else 4.7` and `reviews_count: 128` --
            invented, for a real centre, while ratings.py holds the real ones.
          * `accreditation: "NABL Accredited Diagnostic Center"` and
            `equipment_type: "Schiller 12-Channel ... Electrocardiograph"` --
            regulatory and equipment claims made on a third party behalf with
            nothing behind them.
          * `verified: True` hardcoded, and only *rejected* organisations were
            filtered out, so a centre still awaiting verification was shown as
            a "Registered Diagnostic Center".
          * `price or mrp` -- a centre that had published no price was quoted at
            the catalogue benchmark as though that were their rate.
          * `savings`/`discount_pct` measured against that same benchmark, so
            the "Save Rs X" was against a number the centre never quoted.
          * `address` was read from `organizations.operating_hours` (the table
            has no address column at all; the address lives on `users`).

        Now: verified organisations only, joined to their real address, only
        where they have published a price, priced through PricingService like
        every other offer so the MOU split is identical, and rated from
        provider_ratings or not at all. A service nobody offers comes back with
        an empty `offers` list and `min_price: None` rather than a benchmark
        figure dressed up as a bookable price.
        """
        canonical_services = CANONICAL_RADIOLOGY_SERVICES
        city_filter = (city or "").strip().lower()

        if not supabase:
            return [
                {
                    "id": s["id"], "slug": s["slug"], "name": s["name"],
                    "category": s["category"], "sub_category": s["sub_category"],
                    "typical_turnaround_hours": s["typical_turnaround_hours"],
                    "benchmark_mrp": float(s["mrp"]),
                    "min_price": None, "max_savings": 0.0,
                    "preparation": s.get("preparation", ""),
                    "description": s.get("description", ""),
                    "offers_count": 0, "offers": [],
                }
                for s in canonical_services
            ]

        # -- Real, verified organisations, with the address the patient needs --
        # organizations carries no address; users does. Without the join the
        # card had nothing truthful to print in its address line.
        org_by_id: dict = {}
        try:
            for o in _rows(
                supabase.table("organizations")
                .select("*, users!inner(id, full_name, address, city, district, state)")
                .eq("verification_status", "verified")
                .execute()
            ):
                org_by_id[o["id"]] = o
        except Exception as e:
            logger.error(f"radiology: organizations read failed: {e}")

        try:
            active_org_services = _rows(
                supabase.table("organization_services")
                .select("*").eq("is_active", True).gt("price", 0).execute()
            )
        except Exception as e:
            logger.error(f"radiology: organization_services read failed: {e}")
            active_org_services = []

        try:
            active_prov_services = _rows(
                supabase.table("provider_services")
                .select("*").eq("is_active", True).gt("base_price", 0).execute()
            )
        except Exception as e:
            logger.error(f"radiology: provider_services read failed: {e}")
            active_prov_services = []

        # One index for both branches: an organisation commercial settings row
        # hangs off its login user, the same key provider_services already uses.
        index_ids = {
            s["provider_user_id"] for s in active_prov_services if s.get("provider_user_id")
        }
        for o in org_by_id.values():
            uid = (o.get("users") or {}).get("id") or o.get("user_id")
            if uid:
                index_ids.add(uid)
        provider_index = MarketplaceService._provider_index(list(index_ids))

        from app.services import ratings as _ratings
        rating_summaries = _ratings.get_summaries(list(index_ids), db=supabase) if index_ids else {}

        def _matches(svc: dict, name: str) -> bool:
            """Does this published service name denote this canonical study?"""
            name = (name or "").strip().lower()
            if not name:
                return False
            slug = svc.get("slug", "")
            rules = {
                "x-ray-single": lambda n: "single" in n or "chest pa" in n or "pa view" in n or n == "x-ray",
                "x-ray-double": lambda n: "double" in n or "2 view" in n or "two view" in n,
                "spine-x-ray-single": lambda n: "spine" in n and "single" in n,
                "spine-x-ray-double": lambda n: "spine" in n and ("double" in n or "2" in n or "two" in n),
                "ecg-12-lead": lambda n: "ecg" in n or "electrocardiogram" in n,
                "pft-spirometry": lambda n: "pft" in n or "pulmonary" in n or "spirometry" in n,
                "audiometry-hearing-test": lambda n: "audiometry" in n or "hearing" in n,
            }
            rule = rules.get(slug)
            if rule and rule(name):
                return True
            syns = [svc["name"].lower()] + [str(s).lower() for s in (svc.get("synonyms") or [])]
            return any(syn in name or name in syn for syn in syns)

        def _offer(*, provider_user_id, display_name, list_price, service_id,
                   address, city_name, state, license_number, operating_hours,
                   emergency_phone, head_of_institution, turnaround_hours,
                   provider_kind) -> dict:
            """One bookable offer, carrying only what a record actually holds."""
            settings = provider_index.get(provider_user_id) or {}
            # The centre published price is their list price, and the discount
            # is the one they agreed in provider_settings. Routing it through
            # PricingService is what keeps the 80/20 split and the discount cap
            # identical to every other offer in the marketplace.
            pricing = PricingService.quote(
                list_price, _num(settings.get("partner_discount_pct"))
            )
            summary = rating_summaries.get(provider_user_id) or {}
            return {
                "provider_id": provider_user_id,
                "provider_kind": provider_kind,
                "service_id": service_id,
                "center_name": display_name,
                # Only a real registration number, never a manufactured
                # accreditation claim. The UI omits the line when absent.
                "license_number": license_number or "",
                "address": address or "",
                "city": city_name or "",
                "state": state or "",
                "operating_hours": operating_hours or "",
                "emergency_phone": emergency_phone or "",
                "head_of_institution": head_of_institution or "",
                # None when nobody has rated them yet: an unrated centre is
                # unrated, and the card drops the badge rather than inventing
                # trust for a real business.
                "rating": summary.get("average_stars"),
                "reviews_count": summary.get("rating_count", 0),
                "turnaround_hours": turnaround_hours,
                "mrp": pricing["mrp"],
                "callmedex_price": pricing["price"],
                "savings": pricing["savings"],
                "discount_pct": pricing["discount_pct"],
                "verified": True,
                "is_live": True,
            }

        result: List[dict] = []

        for svc in canonical_services:
            svc_offers: List[dict] = []
            seen: set = set()

            for os_row in active_org_services:
                if not _matches(svc, os_row.get("name", "")):
                    continue
                org = org_by_id.get(os_row.get("organization_id"))
                if not org:
                    continue  # unverified, rejected, or no longer registered
                u = org.get("users") or {}
                uid = u.get("id") or org.get("user_id")
                if not uid or (provider_index.get(uid) or {}).get("is_listed") is False:
                    continue
                org_city = u.get("city") or ""
                haystack = f"{org_city} {u.get('district') or ''} {u.get('state') or ''}".lower()
                if city_filter and city_filter not in haystack:
                    continue
                name = (org.get("organization_name") or "").strip()
                if not name or name.lower() in seen:
                    continue
                seen.add(name.lower())
                svc_offers.append(_offer(
                    provider_user_id=uid,
                    display_name=name,
                    list_price=_num(os_row.get("price")),
                    service_id=os_row.get("id"),
                    address=u.get("address"),
                    city_name=org_city,
                    state=u.get("state"),
                    license_number=org.get("license_number"),
                    operating_hours=org.get("operating_hours"),
                    emergency_phone=org.get("emergency_phone") or org.get("alternate_phone"),
                    head_of_institution=org.get("head_of_institution"),
                    turnaround_hours=svc.get("typical_turnaround_hours"),
                    provider_kind="organization",
                ))

            for ps in active_prov_services:
                if not _matches(svc, ps.get("name", "")):
                    continue
                uid = ps.get("provider_user_id")
                provider = provider_index.get(uid) or {}
                if provider.get("verification_status") != "verified":
                    continue
                if provider.get("is_listed") is False:
                    continue
                p_city = provider.get("city") or ""
                haystack = f"{p_city} {provider.get('district') or ''} {provider.get('state') or ''}".lower()
                if city_filter and city_filter not in haystack:
                    continue
                name = (provider.get("display_name") or "").strip()
                if not name or name.lower() in seen:
                    continue
                seen.add(name.lower())
                svc_offers.append(_offer(
                    provider_user_id=uid,
                    display_name=name,
                    list_price=_num(ps.get("base_price")),
                    service_id=ps.get("id"),
                    address="",  # provider_directory carries no street address
                    city_name=p_city,
                    state=provider.get("state"),
                    license_number="",
                    operating_hours="",
                    emergency_phone="",
                    head_of_institution="",
                    turnaround_hours=ps.get("turnaround_hours") or svc.get("typical_turnaround_hours"),
                    provider_kind=provider.get("provider_type") or "provider",
                ))

            # Cheapest first; a rated centre only outranks an unrated one at the
            # same price, and an unrated centre is not pushed to the bottom.
            svc_offers.sort(
                key=lambda o: (o["callmedex_price"], -(o["rating"] or 0.0))
            )

            result.append({
                "id": svc["id"],
                "slug": svc["slug"],
                "name": svc["name"],
                "category": svc["category"],
                "sub_category": svc["sub_category"],
                "typical_turnaround_hours": svc["typical_turnaround_hours"],
                # Renamed from `mrp`: it is a catalogue benchmark, not any
                # centre quoted price, and the card used to print it as
                # "Standard Benchmark MRP" struck through against a real offer.
                "benchmark_mrp": float(svc["mrp"]),
                # None, not the benchmark, when nobody offers it -- otherwise the
                # grid advertised a bookable price for a service with no centre
                # behind it.
                "min_price": min((o["callmedex_price"] for o in svc_offers), default=None),
                "max_savings": max((o["savings"] for o in svc_offers), default=0.0),
                "preparation": svc.get("preparation", ""),
                "description": svc.get("description", ""),
                "offers_count": len(svc_offers),
                "offers": svc_offers,
            })

        return result

    @staticmethod
    def dental_services_with_offers(city: Optional[str] = None) -> List[dict]:
        """
        Returns canonical dental procedures (19 items from CALL MEDEX - DENTAL PROCEDURE.xlsx)
        along with verified dental clinics and dentists offering each procedure,
        their practice addresses, and transparent walk-in pricing.
        """
        from app.services.scope_catalogs import DENTAL_MASTER_CATALOG
        from app.routers.auth import _local_profiles, _local_users

        city_filter = (city or "").strip().lower()

        # 1. Fetch verified dentists from DB
        dentists_by_id: dict = {}
        if supabase:
            try:
                for d in _rows(
                    supabase.table("dentists")
                    .select("*, users!inner(id, full_name, address, city, district, state, mobile)")
                    .eq("verification_status", "verified")
                    .execute()
                ):
                    dentists_by_id[d["id"]] = d
            except Exception as e:
                logger.error(f"dental: dentists read failed: {e}")

        # Local fallback dentists
        for d in _local_profiles.get("dentists", []):
            uid = d.get("user_id")
            u = _local_users.get(uid) or {}
            if uid and d.get("id") not in dentists_by_id:
                dentists_by_id[d.get("id") or uid] = {**d, "users": u}

        # 2. Fetch verified dental clinics from organizations table
        dental_orgs: dict = {}
        if supabase:
            try:
                for o in _rows(
                    supabase.table("organizations")
                    .select("*, users!inner(id, full_name, address, city, district, state, mobile)")
                    .eq("organization_type", "dental_clinic")
                    .eq("verification_status", "verified")
                    .execute()
                ):
                    dental_orgs[o["id"]] = o
            except Exception as e:
                logger.error(f"dental: dental organizations read failed: {e}")

        # Index provider settings for commercial discounts
        index_ids = set()
        for d in dentists_by_id.values():
            uid = (d.get("users") or {}).get("id") or d.get("user_id")
            if uid:
                index_ids.add(uid)
        for o in dental_orgs.values():
            uid = (o.get("users") or {}).get("id") or o.get("user_id")
            if uid:
                index_ids.add(uid)

        provider_index = MarketplaceService._provider_index(list(index_ids))
        from app.services import ratings as _ratings
        rating_summaries = _ratings.get_summaries(list(index_ids), db=supabase) if index_ids else {}

        result: List[dict] = []

        for proc in DENTAL_MASTER_CATALOG:
            proc_id = proc["id"]
            proc_name = proc["service_name"].lower()
            offers: List[dict] = []
            seen_providers: set = set()

            # Check individual Dentists
            for d in dentists_by_id.values():
                u = d.get("users") or {}
                uid = u.get("id") or d.get("user_id")
                if not uid or uid in seen_providers:
                    continue

                d_city = (u.get("city") or "").lower()
                d_dist = (u.get("district") or "").lower()
                if city_filter and city_filter not in f"{d_city} {d_dist}".lower():
                    continue

                # Check if dentist selected this procedure
                scope = d.get("scope_of_services") or []
                matched_item = None
                if scope:
                    for it in scope:
                        if it.get("id") == proc_id or it.get("service_name", "").lower() == proc_name:
                            matched_item = it
                            break
                else:
                    # If empty scope, default to master procedures
                    matched_item = proc

                if not matched_item or matched_item.get("is_active") is False:
                    continue

                seen_providers.add(uid)
                list_price = _num(matched_item.get("custom_price", proc["benchmark_price"]))
                settings = provider_index.get(uid) or {}
                pricing = PricingService.quote(list_price, _num(settings.get("partner_discount_pct")))
                summary = rating_summaries.get(uid) or {}

                clinic_title = (
                    d.get("clinic_name")
                    or d.get("clinic_center_name")
                    or f"Dr. {u.get('full_name', 'Dentist')} Dental Care"
                )

                offers.append({
                    "provider_id": uid,
                    "provider_kind": "dentist",
                    "center_name": clinic_title,
                    "doctor_name": u.get("full_name") or "Verified Dental Surgeon",
                    "qualification": d.get("qualification") or "BDS / MDS Dental Surgery",
                    "dental_license_number": d.get("dental_license_number") or "",
                    "address": u.get("address") or "",
                    "city": u.get("city") or "",
                    "state": u.get("state") or "",
                    "rating": summary.get("average_stars"),
                    "reviews_count": summary.get("rating_count", 0),
                    "turnaround_hours": 1,
                    "mrp": pricing["mrp"],
                    "callmedex_price": pricing["price"],
                    "savings": pricing["savings"],
                    "discount_pct": pricing["discount_pct"],
                    "modality": "clinic",  # Strictly Walk-In Only
                    "duration": proc.get("duration", "45 Mins (In-Clinic)"),
                    "verified": True,
                    "is_live": True,
                })

            # Check Dental Clinic Organizations
            for o in dental_orgs.values():
                u = o.get("users") or {}
                uid = u.get("id") or o.get("user_id")
                if not uid or uid in seen_providers:
                    continue

                o_city = (u.get("city") or "").lower()
                o_dist = (u.get("district") or "").lower()
                if city_filter and city_filter not in f"{o_city} {o_dist}".lower():
                    continue

                seen_providers.add(uid)
                list_price = proc["benchmark_price"]
                settings = provider_index.get(uid) or {}
                pricing = PricingService.quote(list_price, _num(settings.get("partner_discount_pct")))
                summary = rating_summaries.get(uid) or {}

                offers.append({
                    "provider_id": uid,
                    "provider_kind": "dental_clinic",
                    "center_name": o.get("organization_name") or "CallMedex Dental Partner Clinic",
                    "doctor_name": o.get("head_of_institution") or "Lead Dental Surgeon",
                    "qualification": "Certified Dental Practice",
                    "dental_license_number": o.get("license_number") or "",
                    "address": u.get("address") or "",
                    "city": u.get("city") or "",
                    "state": u.get("state") or "",
                    "rating": summary.get("average_stars"),
                    "reviews_count": summary.get("rating_count", 0),
                    "turnaround_hours": 1,
                    "mrp": pricing["mrp"],
                    "callmedex_price": pricing["price"],
                    "savings": pricing["savings"],
                    "discount_pct": pricing["discount_pct"],
                    "modality": "clinic",
                    "duration": proc.get("duration", "45 Mins (In-Clinic)"),
                    "verified": True,
                    "is_live": True,
                })

            offers.sort(key=lambda x: (x["callmedex_price"], -(x["rating"] or 0.0)))

            result.append({
                "id": proc["id"],
                "slug": proc["id"].replace("_", "-"),
                "name": proc["service_name"],
                "category": "dental",
                "sub_category": proc["category"],
                "billing_class": proc["category"],
                "duration": proc["duration"],
                "benchmark_mrp": float(proc["benchmark_price"]),
                "min_price": min((o["callmedex_price"] for o in offers), default=None),
                "max_savings": max((o["savings"] for o in offers), default=0.0),
                "description": proc.get("description", ""),
                "preparation": "Brush teeth normally prior to your appointment. Avoid chewing tobacco or hard food 1 hour prior.",
                "modality": "clinic",  # Strictly In-Clinic Walk-In Only
                "offers_count": len(offers),
                "offers": offers,
            })

        return result

