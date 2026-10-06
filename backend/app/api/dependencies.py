"""Dependency wiring: builds the long-lived singletons and hands them to routers."""

from functools import lru_cache

from ..clients.adsbdb_client import AdsbdbClient
from ..clients.opensky_client import create_opensky_client
from ..core import config
from ..core.cache import TTLCache
from ..schemas.aircraft import AircraftResponse
from ..services.aircraft_service import AircraftService
from ..services.details_service import DetailsService


@lru_cache
def get_aircraft_service() -> AircraftService:
    cache: TTLCache[AircraftResponse] = TTLCache(config.CACHE_TTL_SECONDS)
    return AircraftService(create_opensky_client(), cache)


@lru_cache
def get_details_service() -> DetailsService:
    # The per-entry TTL is chosen by the service; the cache default is only a fallback.
    return DetailsService(
        AdsbdbClient(),
        TTLCache(config.DETAILS_UNKNOWN_TTL_SECONDS),
        TTLCache(config.DETAILS_UNKNOWN_TTL_SECONDS),
        unknown_ttl_seconds=config.DETAILS_UNKNOWN_TTL_SECONDS,
        aircraft_ttl_seconds=config.AIRCRAFT_INFO_TTL_SECONDS,
    )
