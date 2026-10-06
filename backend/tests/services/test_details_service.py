import asyncio

import pytest

from app.core.cache import TTLCache
from app.core.errors import AdsbdbTimeoutError
from app.services.details_service import DetailsService
from app.services.route_ttl import FALLBACK_TTL_SECONDS, route_ttl_seconds
from tests.conftest import AIRCRAFT_JSON, ROUTE_JSON

UNKNOWN_TTL = 3600.0
AIRCRAFT_TTL = 86400.0


class FakeClient:
    def __init__(self, route=ROUTE_JSON, aircraft=AIRCRAFT_JSON, error=None):
        self.route = route
        self.aircraft = aircraft
        self.error = error
        self.route_calls: list[str] = []
        self.aircraft_calls: list[str] = []

    async def fetch_flightroute(self, callsign):
        self.route_calls.append(callsign)
        if self.error:
            raise self.error
        return self.route

    async def fetch_aircraft(self, icao24):
        self.aircraft_calls.append(icao24)
        if self.error:
            raise self.error
        return self.aircraft


def make(client):
    route_cache, aircraft_cache = TTLCache(1.0), TTLCache(1.0)
    service = DetailsService(client, route_cache, aircraft_cache, UNKNOWN_TTL, AIRCRAFT_TTL)
    return service, route_cache, aircraft_cache


def ttl_of(cache, key):
    return cache._items[key][1]  # (stored_at, ttl, value)


def run(service, *args, **kwargs):
    return asyncio.run(service.get_details(*args, **kwargs))


def test_returns_route_and_aircraft():
    service, _, _ = make(FakeClient())
    details = run(service, "4B1805", "SWR123")
    assert details.route.destination.iata == "ZRH"
    assert details.aircraft.registration == "HB-JCN"


def test_second_lookup_is_served_from_cache():
    client = FakeClient()
    service, _, _ = make(client)
    run(service, "4b1805", "SWR123")
    run(service, "4b1805", "SWR123")
    assert client.route_calls == ["SWR123"]
    assert client.aircraft_calls == ["4b1805"]


def test_callsign_and_icao24_are_normalized_for_lookup_and_cache():
    client = FakeClient()
    service, _, _ = make(client)
    run(service, "4B1805", " swr123 ")
    run(service, "4b1805", "SWR123")
    assert client.route_calls == ["SWR123"]
    assert client.aircraft_calls == ["4b1805"]


@pytest.mark.parametrize("callsign", [None, "", "   "])
def test_no_callsign_means_no_route_lookup(callsign):
    client = FakeClient()
    service, _, _ = make(client)
    details = run(service, "4b1805", callsign)
    assert details.route is None
    assert client.route_calls == []
    assert details.aircraft is not None


def test_unknown_route_returns_none_and_is_cached_with_the_unknown_ttl():
    client = FakeClient(route=None)
    service, route_cache, _ = make(client)
    assert run(service, "4b1805", "ZZZ9999").route is None
    assert run(service, "4b1805", "ZZZ9999").route is None
    assert client.route_calls == ["ZZZ9999"]  # second call came from the cache
    assert ttl_of(route_cache, "ZZZ9999") == UNKNOWN_TTL


def test_unknown_aircraft_returns_none_and_is_cached_with_the_unknown_ttl():
    client = FakeClient(aircraft=None)
    service, _, aircraft_cache = make(client)
    assert run(service, "000000", None).aircraft is None
    run(service, "000000", None)
    assert client.aircraft_calls == ["000000"]
    assert ttl_of(aircraft_cache, "000000") == UNKNOWN_TTL


def test_aircraft_info_uses_the_aircraft_ttl():
    service, _, aircraft_cache = make(FakeClient())
    run(service, "4b1805", None)
    assert ttl_of(aircraft_cache, "4b1805") == AIRCRAFT_TTL


def test_route_ttl_comes_from_remaining_flight_time_when_position_is_given():
    service, route_cache, _ = make(FakeClient())
    # Aircraft over the Swiss/German border region, cruising at 230 m/s.
    run(service, "4b1805", "SWR123", lat=48.0, lon=9.0, velocity=230.0)
    expected = route_ttl_seconds(48.0, 9.0, 230.0, 47.458056, 8.548056)
    assert ttl_of(route_cache, "SWR123") == pytest.approx(expected)
    assert ttl_of(route_cache, "SWR123") != FALLBACK_TTL_SECONDS


def test_route_ttl_falls_back_without_position():
    service, route_cache, _ = make(FakeClient())
    run(service, "4b1805", "SWR123")
    assert ttl_of(route_cache, "SWR123") == FALLBACK_TTL_SECONDS


def test_route_without_destination_coordinates_uses_the_fallback():
    raw = {"callsign": "ABC1", "destination": {"name": "Somewhere"}}
    service, route_cache, _ = make(FakeClient(route=raw))
    run(service, "4b1805", "ABC1", lat=48.0, lon=9.0, velocity=230.0)
    assert ttl_of(route_cache, "ABC1") == FALLBACK_TTL_SECONDS


def test_errors_propagate_and_are_not_cached():
    client = FakeClient(error=AdsbdbTimeoutError())
    service, route_cache, aircraft_cache = make(client)
    with pytest.raises(AdsbdbTimeoutError):
        run(service, "4b1805", "SWR123")
    assert route_cache._items == {}
    assert aircraft_cache._items == {}

    client.error = None
    assert run(service, "4b1805", "SWR123").route is not None
