import asyncio

from ..clients.adsbdb_client import AdsbdbClient
from ..core.cache import MISS, TTLCache
from ..schemas.details import AircraftDetails, AircraftInfo, FlightRoute
from .details_mapper import map_aircraft, map_flightroute
from .route_ttl import route_ttl_seconds


class DetailsService:
    """Route + aircraft details for one aircraft, with long-lived caching.

    Unknown results (adsbdb has no data) are cached too, so repeated lookups of the same unknown
    callsign or aircraft do not hit adsbdb every time.
    """

    def __init__(
        self,
        client: AdsbdbClient,
        route_cache: TTLCache[FlightRoute | None],
        aircraft_cache: TTLCache[AircraftInfo | None],
        unknown_ttl_seconds: float,
        aircraft_ttl_seconds: float,
    ):
        self._client = client
        self._route_cache = route_cache
        self._aircraft_cache = aircraft_cache
        self._unknown_ttl = unknown_ttl_seconds
        self._aircraft_ttl = aircraft_ttl_seconds

    async def get_details(
        self,
        icao24: str,
        callsign: str | None,
        lat: float | None = None,
        lon: float | None = None,
        velocity: float | None = None,
    ) -> AircraftDetails:
        # Both lookups are independent, so run them concurrently. If either fails, the
        # AppError propagates and the global handler reports it.
        route, aircraft = await asyncio.gather(
            self._route(callsign, lat, lon, velocity),
            self._aircraft(icao24),
        )
        return AircraftDetails(route=route, aircraft=aircraft)

    async def _route(
        self, callsign: str | None, lat: float | None, lon: float | None, velocity: float | None
    ) -> FlightRoute | None:
        key = (callsign or "").strip().upper()
        if not key:
            return None  # no callsign, nothing to look up

        cached = self._route_cache.get(key, MISS)
        if cached is not MISS:
            return cached

        raw = await self._client.fetch_flightroute(key)
        if raw is None:
            self._route_cache.set(key, None, ttl=self._unknown_ttl)
            return None

        route = map_flightroute(raw)
        destination = route.destination
        ttl = route_ttl_seconds(
            lat,
            lon,
            velocity,
            destination.lat if destination else None,
            destination.lon if destination else None,
        )
        self._route_cache.set(key, route, ttl=ttl)
        return route

    async def _aircraft(self, icao24: str) -> AircraftInfo | None:
        key = icao24.lower()
        cached = self._aircraft_cache.get(key, MISS)
        if cached is not MISS:
            return cached

        raw = await self._client.fetch_aircraft(key)
        if raw is None:
            self._aircraft_cache.set(key, None, ttl=self._unknown_ttl)
            return None

        info = map_aircraft(raw)
        self._aircraft_cache.set(key, info, ttl=self._aircraft_ttl)
        return info
