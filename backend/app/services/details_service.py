import asyncio

from ..clients.adsbdb_client import AdsbdbClient
from ..core.cache import MISS, TTLCache
from ..core.errors import AdsbdbRateLimitedError
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
        # Both lookups are independent, so run them concurrently. If one lookup fails
        # with an error but the other returns data, return the partial data received
        # instead of raising an error.
        route_res, aircraft_res = await asyncio.gather(
            self._route(callsign, lat, lon, velocity),
            self._aircraft(icao24),
            return_exceptions=True,
        )

        route_exc = route_res if isinstance(route_res, Exception) else None
        aircraft_exc = aircraft_res if isinstance(aircraft_res, Exception) else None

        route = None if route_exc else route_res
        aircraft = None if aircraft_exc else aircraft_res

        # If both lookups resulted in no data and at least one raised an exception, propagate.
        if route is None and aircraft is None:
            if isinstance(route_exc, AdsbdbRateLimitedError):
                raise route_exc
            if isinstance(aircraft_exc, AdsbdbRateLimitedError):
                raise aircraft_exc
            if route_exc:
                raise route_exc
            if aircraft_exc:
                raise aircraft_exc

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
