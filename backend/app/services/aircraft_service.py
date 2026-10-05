from ..clients.opensky_client import OpenSkyClient
from ..core.cache import TTLCache
from ..schemas.aircraft import AircraftResponse
from ..schemas.geo import BoundingBox
from .aircraft_mapper import map_states
from .bounding_box import bounding_box


class AircraftService:
    """Business logic for "which aircraft are near this point"."""

    def __init__(self, client: OpenSkyClient, cache: TTLCache[AircraftResponse]):
        self._client = client
        self._cache = cache

    async def get_nearby(self, lat: float, lon: float, radius_km: float) -> AircraftResponse:
        box: BoundingBox = bounding_box(lat, lon, radius_km)

        cached = self._cache.get(box)
        if cached is not None:
            return cached

        raw = await self._client.fetch_states(box)
        result = map_states(raw)
        self._cache.set(box, result)
        return result
