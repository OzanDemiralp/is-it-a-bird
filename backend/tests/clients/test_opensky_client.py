"""Client layer: every OpenSky transport failure maps to its own AppError. No real network."""

import asyncio

import httpx
import pytest

from app.clients.opensky_client import OpenSkyClient
from app.core import errors
from app.schemas.geo import BoundingBox

BOX = BoundingBox(46.0, 7.0, 48.0, 9.0)


def fetch(handler, client_id=None, client_secret=None):
    client = OpenSkyClient(client_id, client_secret, transport=httpx.MockTransport(handler))
    return asyncio.run(client.fetch_states(BOX))


def test_success_returns_json():
    data = fetch(lambda req: httpx.Response(200, json={"time": 5, "states": None}))
    assert data == {"time": 5, "states": None}


def test_sends_bounding_box_params():
    seen = {}

    def handler(req):
        seen.update(req.url.params)
        return httpx.Response(200, json={})

    fetch(handler)
    assert seen == {"lamin": "46.0", "lomin": "7.0", "lamax": "48.0", "lomax": "9.0"}


def test_timeout_raises_timeout_error():
    def handler(req):
        raise httpx.ReadTimeout("slow")

    with pytest.raises(errors.OpenSkyTimeoutError):
        fetch(handler)


def test_connection_failure_raises_unreachable():
    def handler(req):
        raise httpx.ConnectError("down")

    with pytest.raises(errors.OpenSkyUnreachableError):
        fetch(handler)


def test_429_raises_rate_limited_with_retry_after():
    handler = lambda req: httpx.Response(429, headers={"X-Rate-Limit-Retry-After-Seconds": "30"})
    with pytest.raises(errors.OpenSkyRateLimitedError) as exc:
        fetch(handler)
    assert exc.value.headers == {"Retry-After": "30"}


def test_429_without_header_has_no_retry_after():
    with pytest.raises(errors.OpenSkyRateLimitedError) as exc:
        fetch(lambda req: httpx.Response(429))
    assert exc.value.headers is None


@pytest.mark.parametrize("status", [401, 403])
def test_rejected_credentials_raise_auth_error(status):
    with pytest.raises(errors.OpenSkyAuthError):
        fetch(lambda req: httpx.Response(status))


def test_other_status_raises_bad_response():
    with pytest.raises(errors.OpenSkyBadResponseError):
        fetch(lambda req: httpx.Response(500))


def test_non_json_body_raises_invalid_data():
    with pytest.raises(errors.OpenSkyInvalidDataError):
        fetch(lambda req: httpx.Response(200, content=b"<html>oops</html>"))


def test_non_object_json_raises_invalid_data():
    with pytest.raises(errors.OpenSkyInvalidDataError):
        fetch(lambda req: httpx.Response(200, json=[1, 2, 3]))


def test_token_is_fetched_and_sent_when_credentials_configured():
    seen = {}

    def handler(req):
        if req.url.host == "auth.opensky-network.org":
            return httpx.Response(200, json={"access_token": "tok", "expires_in": 1800})
        seen["auth"] = req.headers.get("authorization")
        return httpx.Response(200, json={})

    fetch(handler, "id", "secret")
    assert seen["auth"] == "Bearer tok"


def test_token_request_failure_raises_auth_error():
    def handler(req):
        if req.url.host == "auth.opensky-network.org":
            return httpx.Response(401)
        return httpx.Response(200, json={})

    with pytest.raises(errors.OpenSkyAuthError):
        fetch(handler, "id", "bad")


def test_malformed_token_response_raises_auth_error():
    def handler(req):
        if req.url.host == "auth.opensky-network.org":
            return httpx.Response(200, json={"nope": 1})
        return httpx.Response(200, json={})

    with pytest.raises(errors.OpenSkyAuthError):
        fetch(handler, "id", "secret")
