"""
P1.3 — Geocoding Service.

Replaces the hardcoded 7-city CITY_COORDS map with Google Geocoding API.
Falls back to Geoapify (already configured) when Google Maps key is absent.

Never silently defaults to Vizag — raises GeocodingError instead.
"""
import json
import logging
import urllib.request
import urllib.error
from typing import Optional, Tuple

from app.config import settings

logger = logging.getLogger(__name__)

# ─── In-memory cache to avoid repeated API calls ─────────────────────────────
_geocode_cache: dict = {}


class GeocodingError(Exception):
    """Raised when geocoding fails and no fallback is available."""
    pass


def geocode_address(
    address: str,
    city: str = "",
    state: str = "",
) -> Tuple[float, float]:
    """Geocode an address string to (lat, lng) coordinates.

    Priority:
      1. In-memory cache hit
      2. Google Geocoding API (if GOOGLE_MAPS_API_KEY is set)
      3. Geoapify API (if GEOAPIFY_API_KEY is set)

    Raises:
        GeocodingError: If all providers fail. Never silently defaults to Vizag.
    """
    # Normalize key for cache
    parts = [p.strip() for p in [address, city, state] if p.strip()]
    cache_key = ", ".join(parts).lower()

    if cache_key in _geocode_cache:
        return _geocode_cache[cache_key]

    query = ", ".join(parts + ["India"])

    # Try Google first
    if settings.GOOGLE_MAPS_API_KEY:
        try:
            result = _google_geocode(query)
            if result:
                _geocode_cache[cache_key] = result
                return result
        except Exception as e:
            logger.warning(f"Google geocoding failed for '{query}': {e}")

    # Try Geoapify fallback
    geoapify_key = getattr(settings, "GEOAPIFY_API_KEY", "") or ""
    if geoapify_key:
        try:
            result = _geoapify_geocode(query, geoapify_key)
            if result:
                _geocode_cache[cache_key] = result
                return result
        except Exception as e:
            logger.warning(f"Geoapify geocoding failed for '{query}': {e}")

    # Try OpenStreetMap Nominatim fallback (tier 3, zero API key required)
    try:
        result = _nominatim_geocode(query)
        if result:
            _geocode_cache[cache_key] = result
            return result
    except Exception as e:
        logger.warning(f"Nominatim geocoding failed for '{query}': {e}")

    raise GeocodingError(
        f"Could not geocode address: '{query}'. "
        f"No geocoding provider returned coordinates."
    )


def get_driving_eta_minutes(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> Optional[int]:
    """Get driving ETA in minutes between two points via Google Distance Matrix.

    Falls back to haversine estimate if Google Maps API key is not configured.

    Returns:
        Estimated minutes, or None if calculation fails.
    """
    if settings.GOOGLE_MAPS_API_KEY:
        try:
            return _google_distance_matrix_eta(
                origin_lat, origin_lng, dest_lat, dest_lng
            )
        except Exception as e:
            logger.warning(f"Google Distance Matrix failed: {e}")

    # Haversine fallback (assumes 25 km/h average in Indian cities)
    return _haversine_eta_minutes(origin_lat, origin_lng, dest_lat, dest_lng)


# ─── Google Geocoding API ────────────────────────────────────────────────────

def _google_geocode(query: str) -> Optional[Tuple[float, float]]:
    """Call Google Geocoding API."""
    encoded_query = urllib.request.quote(query)
    url = (
        f"https://maps.googleapis.com/maps/api/geocode/json"
        f"?address={encoded_query}&key={settings.GOOGLE_MAPS_API_KEY}"
    )

    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    results = data.get("results", [])
    if not results:
        return None

    location = results[0].get("geometry", {}).get("location", {})
    lat = location.get("lat")
    lng = location.get("lng")
    if lat is not None and lng is not None:
        return (float(lat), float(lng))

    return None


def _google_distance_matrix_eta(
    origin_lat: float, origin_lng: float,
    dest_lat: float, dest_lng: float,
) -> Optional[int]:
    """Call Google Distance Matrix API for driving ETA."""
    url = (
        f"https://maps.googleapis.com/maps/api/distancematrix/json"
        f"?origins={origin_lat},{origin_lng}"
        f"&destinations={dest_lat},{dest_lng}"
        f"&mode=driving"
        f"&key={settings.GOOGLE_MAPS_API_KEY}"
    )

    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    rows = data.get("rows", [])
    if not rows:
        return None

    elements = rows[0].get("elements", [])
    if not elements or elements[0].get("status") != "OK":
        return None

    duration_seconds = elements[0].get("duration", {}).get("value", 0)
    return max(1, duration_seconds // 60)


# ─── Geoapify Fallback ──────────────────────────────────────────────────────

def _geoapify_geocode(query: str, api_key: str) -> Optional[Tuple[float, float]]:
    """Call Geoapify Geocoding API (already configured in .env)."""
    encoded_query = urllib.request.quote(query)
    url = (
        f"https://api.geoapify.com/v1/geocode/search"
        f"?text={encoded_query}&apiKey={api_key}&limit=1"
    )

    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    features = data.get("features", [])
    if not features:
        return None

    coords = features[0].get("geometry", {}).get("coordinates", [])
    if len(coords) >= 2:
        # Geoapify returns [lng, lat] (GeoJSON order)
        return (float(coords[1]), float(coords[0]))

    return None


# ─── OpenStreetMap Nominatim Fallback ──────────────────────────────────────

def _nominatim_geocode(query: str) -> Optional[Tuple[float, float]]:
    """Call OpenStreetMap Nominatim Geocoding API with polite User-Agent."""
    encoded_query = urllib.request.quote(query)
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={encoded_query}&countrycodes=in&limit=1"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "CallMedex-Healthcare-Platform/2.0", "Accept-Language": "en"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lng = float(data[0]["lon"])
                return (lat, lng)
    except Exception as e:
        logger.warning(f"Nominatim request failed: {e}")
    return None


# ─── Haversine Fallback ─────────────────────────────────────────────────────

def _haversine_eta_minutes(
    lat1: float, lng1: float,
    lat2: float, lng2: float,
    avg_speed_kmh: float = 25.0,
) -> int:
    """Estimate driving time using haversine distance and average city speed."""
    import math

    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance_km = R * c

    # Add 30% for road detours vs straight-line
    road_distance_km = distance_km * 1.3
    hours = road_distance_km / avg_speed_kmh
    return max(1, round(hours * 60))
