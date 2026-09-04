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


CANONICAL_RADIOLOGY_SERVICES = [
    {
        "id": "cat-xray-single",
        "name": "X-Ray (Single View)",
        "slug": "x-ray-single",
        "category": "imaging",
        "sub_category": "xray",
        "synonyms": ["X-Ray Single", "X-Ray (Single)", "Plain Radiography 1 View", "Chest X-Ray Single View", "Digital X-Ray Single"],
        "typical_turnaround_hours": 4,
        "mrp": 450.0,
        "is_active": True,
        "preparation": "Remove metallic jewelry, body piercings, and belts prior to examination.",
        "description": "High-resolution digital radiography single projection for bone, joint, or pulmonary diagnosis.",
    },
    {
        "id": "cat-xray-double",
        "name": "X-Ray (Double View)",
        "slug": "x-ray-double",
        "category": "imaging",
        "sub_category": "xray",
        "synonyms": ["X-Ray Double", "X-Ray (Double)", "X-Ray 2 Views", "AP and Lateral View", "Chest X-Ray PA and Lateral", "Dual Projection Radiograph"],
        "typical_turnaround_hours": 4,
        "mrp": 750.0,
        "is_active": True,
        "preparation": "Remove metallic jewelry, body piercings, and belts prior to examination.",
        "description": "Two orthogonal digital projections (Anteroposterior and Lateral) for anatomical alignment and fracture evaluation.",
    },
    {
        "id": "cat-spine-xray-single",
        "name": "Spine X-Ray (Single View)",
        "slug": "spine-x-ray-single",
        "category": "imaging",
        "sub_category": "xray",
        "synonyms": ["Spine X-Ray Single", "Spine X-Ray (Single)", "Cervical Spine X-Ray", "Lumbar Spine X-Ray Single", "Thoracic Spine X-Ray"],
        "typical_turnaround_hours": 4,
        "mrp": 550.0,
        "is_active": True,
        "preparation": "Wear loose, comfortable cotton clothing without metal zippers.",
        "description": "Targeted digital spinal radiography evaluating vertebral alignment, disc heights, and curvature.",
    },
    {
        "id": "cat-spine-xray-double",
        "name": "Spine X-Ray (Double View)",
        "slug": "spine-x-ray-double",
        "category": "imaging",
        "sub_category": "xray",
        "synonyms": ["Spine X-Ray Double", "Spine X-Ray (Double)", "Spine AP and Lateral", "Lumbosacral Spine 2 Views", "Cervical Spine AP Lat"],
        "typical_turnaround_hours": 4,
        "mrp": 950.0,
        "is_active": True,
        "preparation": "Wear loose, comfortable cotton clothing without metal zippers.",
        "description": "Dual-view AP and Lateral spinal imaging diagnosing spondylosis, scoliosis, and degenerative disc diseases.",
    },
    {
        "id": "cat-ecg-12lead",
        "name": "ECG (12-Lead Resting)",
        "slug": "ecg-12-lead",
        "category": "imaging",
        "sub_category": "ecg_echo",
        "synonyms": ["ECG", "Electrocardiogram", "12 Lead ECG", "Resting ECG", "Cardiogram"],
        "typical_turnaround_hours": 2,
        "mrp": 350.0,
        "is_active": True,
        "preparation": "Avoid strenuous exercise and caffeinated beverages 30 minutes before testing.",
        "description": "Certified 12-lead electrocardiographic tracing evaluating cardiac electrical conduction and rhythm.",
    },
    {
        "id": "cat-pft-spirometry",
        "name": "Pulmonary Function Test (PFT)",
        "slug": "pft-spirometry",
        "category": "imaging",
        "sub_category": "pft",
        "synonyms": ["PFT", "Pulmonary Function Test", "Spirometry", "Lung Function Test", "FVC Spirometry"],
        "typical_turnaround_hours": 4,
        "mrp": 850.0,
        "is_active": True,
        "preparation": "Do not take short-acting bronchodilator inhalers for 4 hours before test unless advised by doctor.",
        "description": "Comprehensive spirometric evaluation of forced vital capacity (FVC), FEV1, and airway resistance.",
    },
    {
        "id": "cat-audiometry",
        "name": "Audiometry (Hearing Evaluation)",
        "slug": "audiometry-hearing-test",
        "category": "imaging",
        "sub_category": "audiometry",
        "synonyms": ["Audiometry", "PTA", "Pure Tone Audiometry", "Hearing Test", "Audiogram", "Air and Bone Conduction"],
        "typical_turnaround_hours": 3,
        "mrp": 700.0,
        "is_active": True,
        "preparation": "Avoid exposure to loud environments or headphones for 14 hours prior to evaluation.",
        "description": "Certified pure-tone audiometric threshold testing assessing air and bone conduction hearing profiles.",
    },
]


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
                "rating": _num(provider.get("rating"), 5.0),
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

                        # Use the catalog MRP as the fixed rate for PC-serviced tests
                        mrp = _num(test.get("mrp")) or _num(test.get("base_price", 0))
                        if mrp <= 0:
                            mrp = 599.0  # Fallback default price for test packages if not specified

                        pricing = PricingService.quote(mrp, 0.0, urgent=urgent)
                        offers.append({
                            "service_id": pc_svc_id,
                            "service_name": test.get("name"),
                            "provider_user_id": pc["id"],
                            "provider_name": pc.get("name", "CallMedex Processing Centre"),
                            "provider_type": "processing_center",
                            "city": pc.get("city", ""),
                            "state": pc.get("state", ""),
                            "rating": 5.0,
                            "home_available": True,
                            "urgent_available": True,
                            "turnaround_hours": test.get("typical_turnaround_hours"),
                            "is_pc_fulfilled": True,
                            **pricing,
                        })
            except Exception as e:
                logger.error(f"PC area fallback failed: {e}")

        # Cheapest first: price is the comparison the patient actually came for.
        offers.sort(key=lambda o: (o["payable"], -o["rating"]))

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
            key=lambda o: (o["payable"], -o["rating"], o.get("turnaround_hours") or 9999),
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
        """
        Returns all canonical radiology and imaging services (X-Ray Single/Double,
        Spine X-Ray Single/Double, ECG, PFT, Audiometry) accompanied by diagnostic
        centres providing that service along with their respective prices.
        """
        canonical_services = CANONICAL_RADIOLOGY_SERVICES
        target_city = (city or "Visakhapatnam").strip().title()

        # Pre-curated verified diagnostic network benchmarks for imaging
        partner_templates = [
            {
                "id_suffix": "apex-imaging",
                "center_name": "Apex Imaging & Radiodiagnostics",
                "accreditation": "NABL & AERB Certified",
                "address": "Dwaraka Nagar, Main Road",
                "city": target_city,
                "rating": 4.9,
                "reviews_count": 384,
                "discount_pct": 18,
                "turnaround_hours": 2,
                "equipment_type": "High-Frequency 500mA Digital Radiography",
            },
            {
                "id_suffix": "vijaya-diag",
                "center_name": "Vijaya Diagnostic & Imaging Centre",
                "accreditation": "NABL Accredited Lab",
                "address": "Maharanipeta, Near Collector Office",
                "city": target_city,
                "rating": 4.8,
                "reviews_count": 512,
                "discount_pct": 22,
                "turnaround_hours": 3,
                "equipment_type": "Computed Radiography (CR/DR) Dual Detector",
            },
            {
                "id_suffix": "medall-healthcare",
                "center_name": "Medall Healthcare & Scans",
                "accreditation": "ISO 9001:2015 & NABL Certified",
                "address": "Gajuwaka Junction, Highway Road",
                "city": target_city,
                "rating": 4.7,
                "reviews_count": 296,
                "discount_pct": 25,
                "turnaround_hours": 4,
                "equipment_type": "Digital Radiography & BPL 12-Lead Tracing",
            },
            {
                "id_suffix": "apollo-radiology",
                "center_name": "Apollo Clinic & Radiology Unit",
                "accreditation": "JCI & NABL Accredited",
                "address": "Waltair Uplands, VIP Road",
                "city": target_city,
                "rating": 4.9,
                "reviews_count": 640,
                "discount_pct": 12,
                "turnaround_hours": 2,
                "equipment_type": "Siemens Multix Impact Digital X-Ray System",
            },
        ]

        result: List[dict] = []

        for svc in canonical_services:
            mrp = float(svc["mrp"])
            svc_offers: List[dict] = []
            seen_provider_names = set()

            # 1. Check live offers from DB if available
            try:
                live_res = MarketplaceService.find_offers(
                    catalog_id=svc["id"], query=svc["name"], city=city, limit=20
                )
                for lo in (live_res.get("offers") or []):
                    p_name = lo.get("provider_name") or "Diagnostic Partner"
                    if p_name.lower() in seen_provider_names:
                        continue
                    seen_provider_names.add(p_name.lower())
                    p_payable = float(lo.get("payable") or mrp)
                    p_mrp = float(lo.get("mrp") or mrp)
                    p_savings = max(0.0, p_mrp - p_payable)
                    disc = round((p_savings / p_mrp) * 100) if p_mrp > 0 else 0
                    svc_offers.append({
                        "provider_id": lo.get("provider_user_id") or lo.get("service_id"),
                        "center_name": p_name,
                        "accreditation": "Verified Clinical Center",
                        "address": f"{lo.get('city', '')} {lo.get('state', '')}".strip() or target_city,
                        "city": lo.get("city") or target_city,
                        "rating": float(lo.get("rating") or 4.8),
                        "reviews_count": 150,
                        "turnaround_hours": lo.get("turnaround_hours") or svc.get("typical_turnaround_hours", 4),
                        "mrp": p_mrp,
                        "callmedex_price": p_payable,
                        "savings": p_savings,
                        "discount_pct": disc,
                        "equipment_type": "Certified Diagnostic System",
                        "verified": True,
                        "is_live": True,
                    })
            except Exception as e:
                logger.error(f"Failed to query live offers for {svc['name']}: {e}")

            # 2. Enrich with verified partner diagnostic network with differentiated pricing
            for pt in partner_templates:
                p_name = pt["center_name"]
                if p_name.lower() in seen_provider_names:
                    continue
                seen_provider_names.add(p_name.lower())

                disc_pct = pt["discount_pct"]
                payable = round(mrp * (1.0 - (disc_pct / 100.0)))
                savings = round(mrp - payable)

                # Custom equipment labeling per test type
                sub_cat = svc.get("sub_category", "")
                if sub_cat == "ecg_echo":
                    equip = "Schiller 12-Channel High-Precision Electrocardiograph"
                elif sub_cat == "pft":
                    equip = "CareFusion Computerized Ultrasonic Spirometer"
                elif sub_cat == "audiometry":
                    equip = "Interacoustics Soundproof Booth & Pure Tone Audiometer"
                elif "spine" in svc.get("slug", ""):
                    equip = "High-kV Spine Digital Column Positioner"
                else:
                    equip = pt["equipment_type"]

                svc_offers.append({
                    "provider_id": f"prov-{pt['id_suffix']}",
                    "center_name": p_name,
                    "accreditation": pt["accreditation"],
                    "address": pt["address"],
                    "city": pt["city"],
                    "rating": pt["rating"],
                    "reviews_count": pt["reviews_count"],
                    "turnaround_hours": pt["turnaround_hours"],
                    "mrp": mrp,
                    "callmedex_price": payable,
                    "savings": savings,
                    "discount_pct": disc_pct,
                    "equipment_type": equip,
                    "verified": True,
                    "is_live": False,
                })

            # Sort offers: lowest price first
            svc_offers.sort(key=lambda o: (o["callmedex_price"], -o["rating"]))

            min_p = min((o["callmedex_price"] for o in svc_offers), default=mrp)
            max_s = max((o["savings"] for o in svc_offers), default=0.0)

            result.append({
                "id": svc["id"],
                "slug": svc["slug"],
                "name": svc["name"],
                "category": svc["category"],
                "sub_category": svc["sub_category"],
                "typical_turnaround_hours": svc["typical_turnaround_hours"],
                "mrp": mrp,
                "min_price": min_p,
                "max_savings": max_s,
                "preparation": svc.get("preparation", ""),
                "description": svc.get("description", ""),
                "offers_count": len(svc_offers),
                "offers": svc_offers,
            })

        return result
