"""adsbdb client: transport failures map to their own AppError; 404 means "unknown" (None)."""

import asyncio

import httpx
import pytest

from app.clients.adsbdb_client import AdsbdbClient
from app.core import errors
from tests.conftest import AIRCRAFT_JSON, ROUTE_JSON


def call(method: str, arg: str, handler):
    client = AdsbdbClient(transport=httpx.MockTransport(handler))
    return asyncio.run(getattr(client, method)(arg))


def test_flightroute_success_unwraps_response():
    result = call(
        "fetch_flightroute",
        "SWR123",
        lambda req: httpx.Response(200, json={"response": {"flightroute": ROUTE_JSON}}),
    )
    assert result == ROUTE_JSON


def test_aircraft_success_unwraps_response():
    result = call(
        "fetch_aircraft",
        "4b1805",
        lambda req: httpx.Response(200, json={"response": {"aircraft": AIRCRAFT_JSON}}),
    )
    assert result == AIRCRAFT_JSON


def test_requests_the_expected_paths():
    seen = []

    def handler(req):
        seen.append(req.url.path)
        return httpx.Response(404, json={"response": "unknown"})

    call("fetch_flightroute", "SWR123", handler)
    call("fetch_aircraft", "4b1805", handler)
    assert seen == ["/v0/callsign/SWR123", "/v0/aircraft/4b1805"]


def test_404_means_unknown_and_returns_none():
    handler = lambda req: httpx.Response(404, json={"response": "unknown callsign"})
    assert call("fetch_flightroute", "ZZZ9999", handler) is None
    assert call("fetch_aircraft", "000000", handler) is None


def test_timeout_raises_timeout_error():
    def handler(req):
        raise httpx.ReadTimeout("slow")

    with pytest.raises(errors.AdsbdbTimeoutError):
        call("fetch_flightroute", "SWR123", handler)


def test_connection_failure_raises_unreachable():
    def handler(req):
        raise httpx.ConnectError("down")

    with pytest.raises(errors.AdsbdbUnreachableError):
        call("fetch_aircraft", "4b1805", handler)


def test_429_raises_rate_limited_with_retry_after():
    handler = lambda req: httpx.Response(429, headers={"Retry-After": "15"})
    with pytest.raises(errors.AdsbdbRateLimitedError) as exc:
        call("fetch_flightroute", "SWR123", handler)
    assert exc.value.headers == {"Retry-After": "15"}


def test_other_status_raises_bad_response():
    with pytest.raises(errors.AdsbdbBadResponseError):
        call("fetch_flightroute", "SWR123", lambda req: httpx.Response(500))


def test_non_json_body_raises_invalid_data():
    with pytest.raises(errors.AdsbdbInvalidDataError):
        call("fetch_flightroute", "SWR123", lambda req: httpx.Response(200, content=b"<html>"))


def test_non_object_json_raises_invalid_data():
    with pytest.raises(errors.AdsbdbInvalidDataError):
        call("fetch_flightroute", "SWR123", lambda req: httpx.Response(200, json=[1]))


@pytest.mark.parametrize(
    "body",
    [
        {"response": "unknown callsign"},  # 200 but a string instead of an object
        {"response": {"other": {}}},  # missing the expected key
        {"nope": 1},
    ],
)
def test_unexpected_200_shape_raises_invalid_data(body):
    with pytest.raises(errors.AdsbdbInvalidDataError):
        call("fetch_flightroute", "SWR123", lambda req: httpx.Response(200, json=body))
