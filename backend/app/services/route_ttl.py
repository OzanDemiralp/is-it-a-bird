"""Pure math: how long should a cached route stay valid?

A callsign's route is fixed for one flight. Once the flight lands, the same callsign may fly a
different route, so we cache until the flight should be over: remaining distance / ground speed.
"""

import math

EARTH_RADIUS_M = 6_371_000.0

SAFETY_MARGIN = 1.25  # +25% for headwinds, holding, etc.
MIN_TTL_SECONDS = 5 * 60
MAX_TTL_SECONDS = 12 * 3600
FALLBACK_TTL_SECONDS = 30 * 60
# Below this ground speed (m/s, ~100 kt) the aircraft is taxiing, taking off or landing, so
# distance / speed would be meaningless. Use the fallback instead.
MIN_RELIABLE_SPEED_MS = 50.0


def great_circle_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance on a spherical Earth (accurate to ~0.5%, plenty for a TTL)."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def route_ttl_seconds(
    aircraft_lat: float | None,
    aircraft_lon: float | None,
    velocity_ms: float | None,
    destination_lat: float | None,
    destination_lon: float | None,
) -> float:
    """Seconds to cache a route; falls back to a fixed value when inputs are missing/unreliable."""
    if None in (aircraft_lat, aircraft_lon, velocity_ms, destination_lat, destination_lon):
        return FALLBACK_TTL_SECONDS
    assert velocity_ms is not None  # for the type checker; guaranteed by the check above
    if velocity_ms < MIN_RELIABLE_SPEED_MS:
        return FALLBACK_TTL_SECONDS

    distance = great_circle_distance_m(
        aircraft_lat, aircraft_lon, destination_lat, destination_lon  # type: ignore[arg-type]
    )
    ttl = distance / velocity_ms * SAFETY_MARGIN
    return min(max(ttl, MIN_TTL_SECONDS), MAX_TTL_SECONDS)
