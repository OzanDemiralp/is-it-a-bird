import asyncio

import pytest

from app.core.cache import TTLCache
from app.core.errors import OpenSkyTimeoutError
from app.schemas.geo import BoundingBox
from app.services.aircraft_service import AircraftService
from app.services.bounding_box import bounding_box
from tests.conftest import FULL_ROW


class FakeClient:
    def __init__(self, error=None):
        self.calls: list[BoundingBox] = []
        self.error = error

    async def fetch_states(self, box):
        self.calls.append(box)
        if self.error:
            raise self.error
        return {"time": 1, "states": [FULL_ROW]}


def make_service(client, ttl=60.0):
    return AircraftService(client, TTLCache(ttl))


def test_bounding_box_math():
    # 111.32 km radius at the equator is exactly 1 degree in each direction.
    assert bounding_box(0, 0, 111.32) == BoundingBox(-1.0, -1.0, 1.0, 1.0)


def test_bounding_box_is_clamped_near_pole():
    box = bounding_box(89.9, 179.9, 100)
    assert box.lamax == 90.0
    assert box.lomax == 180.0


def test_same_box_is_served_from_cache():
    client = FakeClient()
    service = make_service(client)
    asyncio.run(service.get_nearby(47.45, 8.55, 20))
    # A few meters away rounds to the same box -> cache hit.
    asyncio.run(service.get_nearby(47.45001, 8.55, 20))
    assert len(client.calls) == 1


def test_expired_cache_refetches():
    client = FakeClient()
    service = make_service(client, ttl=0.0)
    asyncio.run(service.get_nearby(47.45, 8.55, 20))
    asyncio.run(service.get_nearby(47.45, 8.55, 20))
    assert len(client.calls) == 2


def test_errors_propagate_and_are_not_cached():
    client = FakeClient(error=OpenSkyTimeoutError())
    service = make_service(client)
    with pytest.raises(OpenSkyTimeoutError):
        asyncio.run(service.get_nearby(47.45, 8.55, 20))
    client.error = None
    result = asyncio.run(service.get_nearby(47.45, 8.55, 20))
    assert result.count == 1
