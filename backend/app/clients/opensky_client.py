"""HTTP client for the OpenSky Network `GET /states/all` endpoint.

Docs: https://openskynetwork.github.io/opensky-api/rest.html

This layer only talks to OpenSky and translates transport failures into AppErrors.
It knows nothing about caching or aircraft models.
"""

import time
from typing import Any

import httpx

from ..core import config
from ..core.errors import (
    OpenSkyAuthError,
    OpenSkyBadResponseError,
    OpenSkyInvalidDataError,
    OpenSkyRateLimitedError,
    OpenSkyTimeoutError,
    OpenSkyUnreachableError,
)
from ..schemas.geo import BoundingBox

STATES_URL = "https://opensky-network.org/api/states/all"
TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
)
REQUEST_TIMEOUT_SECONDS = 10.0


class OpenSkyClient:
    def __init__(
        self,
        client_id: str | None,
        client_secret: str | None,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self._client_id = client_id
        self._client_secret = client_secret
        self._transport = transport  # tests inject a mock; None means real network
        self._token: str | None = None
        self._token_expires_at: float = 0.0

    async def fetch_states(self, box: BoundingBox) -> dict[str, Any]:
        """Return OpenSky's decoded JSON for the box, or raise an AppError."""
        params = {
            "lamin": box.lamin,
            "lomin": box.lomin,
            "lamax": box.lamax,
            "lomax": box.lomax,
        }
        try:
            async with httpx.AsyncClient(
                timeout=REQUEST_TIMEOUT_SECONDS, transport=self._transport
            ) as http:
                headers = await self._auth_headers(http)
                response = await http.get(STATES_URL, params=params, headers=headers)
        except httpx.TimeoutException:
            raise OpenSkyTimeoutError() from None
        except httpx.HTTPError:
            raise OpenSkyUnreachableError() from None

        if response.status_code == 429:
            retry = response.headers.get("X-Rate-Limit-Retry-After-Seconds")
            headers_out = {"Retry-After": retry} if retry and retry.isdigit() else None
            raise OpenSkyRateLimitedError(headers=headers_out)
        if response.status_code in (401, 403):
            self._token = None  # force a fresh token next time
            raise OpenSkyAuthError(f"OpenSky rejected our credentials (HTTP {response.status_code})")
        if response.status_code != 200:
            raise OpenSkyBadResponseError(f"OpenSky returned HTTP {response.status_code}")
        try:
            data = response.json()
        except ValueError:
            raise OpenSkyInvalidDataError("OpenSky returned a non-JSON body") from None
        if not isinstance(data, dict):
            raise OpenSkyInvalidDataError("OpenSky returned an unexpected JSON structure")
        return data

    async def _auth_headers(self, http: httpx.AsyncClient) -> dict[str, str]:
        """Bearer header if credentials are configured, otherwise anonymous (no header)."""
        if not (self._client_id and self._client_secret):
            return {}
        if self._token is None or time.monotonic() >= self._token_expires_at:
            await self._refresh_token(http)
        return {"Authorization": f"Bearer {self._token}"}

    async def _refresh_token(self, http: httpx.AsyncClient) -> None:
        response = await http.post(
            TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
            },
        )
        if response.status_code != 200:
            raise OpenSkyAuthError(f"OpenSky token request failed (HTTP {response.status_code})")
        try:
            body = response.json()
            self._token = body["access_token"]
            expires_in = body.get("expires_in", 1800)
        except (ValueError, KeyError, TypeError, AttributeError):
            raise OpenSkyAuthError("OpenSky token response was malformed") from None
        self._token_expires_at = time.monotonic() + expires_in - 30  # refresh 30 s early


def create_opensky_client() -> OpenSkyClient:
    return OpenSkyClient(config.OPENSKY_CLIENT_ID, config.OPENSKY_CLIENT_SECRET)
