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
from typing import List, Optional

from app.database import supabase

logger = logging.getLogger(__name__)

EARTH_KM = 6371.0


def _rows(result) -> List[dict]:
    data = getattr(result, "data", None) or []
    return [dict(r) for r in data if isinstance(r, dict)]


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
        default = {"mode": "flat", "flat_inr": 200, "percent": 0, "min_inr": 0, "max_inr": 1000}
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
        """Rupee surcharge for a priority booking at this price point."""
        cfg = PricingService.urgent_surcharge_config()
        if cfg.get("mode") == "percent":
            amount = base_price * _num(cfg.get("percent")) / 100.0
        else:
            amount = _num(cfg.get("flat_inr"))

        lo, hi = _num(cfg.get("min_inr")), _num(cfg.get("max_inr"))
        if hi > 0:
            amount = min(amount, hi)
        return round(max(amount, lo), 2)

    @staticmethod
    def quote(mrp: float, discount_pct: float, urgent: bool = False) -> dict:
        """
        Price one service.

        MRP is what the partner charges at their own counter. A missing or
        nonsensical discount is treated as zero rather than guessed at — showing
        a saving that was never negotiated would be a false claim to the patient
        and an unfunded liability for the partner.
        """
        mrp = round(max(_num(mrp), 0.0), 2)
        pct = _num(discount_pct)
        if pct < 0 or pct >= 100:
            pct = 0.0

        price = round(mrp * (1 - pct / 100.0), 2)
        savings = round(mrp - price, 2)

        surcharge = PricingService.urgent_surcharge_for(price) if urgent else 0.0

        return {
            "mrp": mrp,
            "discount_pct": round(pct, 2),
            "price": price,
            "savings": savings,
            "urgent_surcharge": surcharge,
            "payable": round(price + surcharge, 2),
        }


class MarketplaceService:
    """Test-first discovery across partner centres."""

    # ── Catalogue search ──────────────────────────────────────────────────

    @staticmethod
    def search_catalog(query: str, limit: int = 20) -> list:
        """
        Match a search term against canonical test names AND their synonyms.

        Synonyms are why "MRI" finds "Magnetic Resonance Imaging" and "sugar
        test" finds "Fasting Blood Sugar" — patients search in the words they
        use, not the words a lab prints on a requisition.
        """
        if not supabase:
            return []
        q = (query or "").strip().lower()
        try:
            catalog = _rows(
                supabase.table("service_catalog")
                .select("*").eq("is_active", True).limit(300).execute()
            )
        except Exception as e:
            logger.error(f"search_catalog failed: {e}")
            return []

        if not q:
            return catalog[:limit]

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
            test = _first(
                supabase.table("service_catalog").select("*").eq("id", catalog_id).limit(1).execute()
            )
        elif query:
            matches = MarketplaceService.search_catalog(query, limit=1)
            test = matches[0] if matches else None

        try:
            services_q = supabase.table("provider_services").select("*").eq("is_active", True)
            if test:
                services_q = services_q.eq("catalog_id", test["id"])
            services = _rows(services_q.limit(400).execute())
        except Exception as e:
            logger.error(f"find_offers services read failed: {e}")
            return {"test": test, "offers": []}

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

        # Cheapest first: price is the comparison the patient actually came for.
        offers.sort(key=lambda o: (o["payable"], -o["rating"]))

        return {
            "test": test,
            "offers": offers[:limit],
            "total": len(offers),
            "urgent": urgent,
        }

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
        try:
            catalog = _rows(
                supabase.table("service_catalog")
                .select("*").eq("is_active", True).limit(200).execute()
            )
            services = _rows(
                supabase.table("provider_services")
                .select("catalog_id").eq("is_active", True).limit(500).execute()
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
