"""Dependency wiring: builds the long-lived singletons and hands them to routers."""

from functools import lru_cache

from ..clients.opensky_client import create_opensky_client
from ..core import config
from ..core.cache import TTLCache
from ..schemas.aircraft import AircraftResponse
from ..services.aircraft_service import AircraftService


@lru_cache
def get_aircraft_service() -> AircraftService:
    cache: TTLCache[AircraftResponse] = TTLCache(config.CACHE_TTL_SECONDS)
    return AircraftService(create_opensky_client(), cache)
