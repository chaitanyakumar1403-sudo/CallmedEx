"""
Which consultation modes a doctor actually offers.

`doctors.consultation_mode` is a single enum ('online' | 'in_person' |
'home_visit' | 'both'), but a doctor publishes modes independently: the
workstation writes one `doctor_availability` row per weekday per mode and one
`consultation_fees` row per mode. A doctor with 18 walk-in blocks, 7 online
blocks and a home-visit tariff still carries the single value 'both' — so
`.eq("consultation_mode", "home_visit")` returned nobody for the Home Visit
tab even when that doctor had a published home-visit fee, and the Walk-in tab
only worked because the frontend queried 'in_person' and 'both' separately and
merged them.

Resolve the real set once, from what the doctor published, and let every
listing filter on membership.
"""
import logging
from typing import Dict, Iterable, Set

from app.database import supabase
from app.utils.db_helpers import _rows

logger = logging.getLogger(__name__)

CANONICAL_MODES = ("in_person", "online", "home_visit")

# The legacy single-value column, expanded to the set it was standing in for.
_ENUM_EXPANSION = {
    "both": {"in_person", "online"},
    "online": {"online"},
    "teleconsultation": {"online"},
    "video": {"online"},
    "in_person": {"in_person"},
    "offline": {"in_person"},
    "walkin": {"in_person"},
    "walk_in": {"in_person"},
    "clinic": {"in_person"},
    "home_visit": {"home_visit"},
    "home": {"home_visit"},
}


def normalise_mode(value: str | None) -> Set[str]:
    """Map any spelling of a mode onto the canonical set it represents."""
    key = (value or "").strip().lower().replace("-", "_").replace(" ", "_")
    return set(_ENUM_EXPANSION.get(key, set()))


def resolve_modes(doctor_user_ids: Iterable[str]) -> Dict[str, Set[str]]:
    """Map each doctor's users.id to the set of modes they actually offer.

    Union of three signals, strongest first:
      1. published availability blocks  (doctor_availability, is_active)
      2. published tariffs              (consultation_fees, is_active)
      3. the legacy doctors.consultation_mode enum, expanded

    A doctor who has published nothing at all still gets their enum's modes, so
    this never removes supply that the old query would have shown.
    """
    ids = [i for i in dict.fromkeys(doctor_user_ids) if i]
    modes: Dict[str, Set[str]] = {i: set() for i in ids}
    if not ids or not supabase:
        return modes

    try:
        for row in _rows(
            supabase.table("doctor_availability")
            .select("doctor_id, consultation_mode")
            .in_("doctor_id", ids).eq("is_active", True).execute()
        ):
            modes.setdefault(row["doctor_id"], set()).update(
                normalise_mode(row.get("consultation_mode"))
            )
    except Exception as e:
        logger.warning(f"availability mode lookup failed: {e}")

    try:
        for row in _rows(
            supabase.table("consultation_fees")
            .select("doctor_id, fee_type")
            .in_("doctor_id", ids).eq("is_active", True).execute()
        ):
            modes.setdefault(row["doctor_id"], set()).update(
                normalise_mode(row.get("fee_type"))
            )
    except Exception as e:
        logger.warning(f"tariff mode lookup failed: {e}")

    return modes


def offers_mode(published: Set[str], enum_value: str | None, wanted: str) -> bool:
    """Does this doctor offer `wanted`?

    Falls back to the legacy enum only when the doctor has published nothing —
    otherwise what they published wins, since that is what they maintain.
    """
    target = normalise_mode(wanted)
    if not target:
        return True  # unknown filter value — do not silently hide anybody
    effective = published or normalise_mode(enum_value)
    return bool(effective & target)
