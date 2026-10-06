"""HTTP client for adsbdb (https://www.adsbdb.com), a free callsign / aircraft lookup API.

Only talks to adsbdb and turns transport failures into AppErrors. "Not found" (HTTP 404) is
normal, so it returns None instead of raising.
"""

from typing import Any

import httpx

from ..core.errors import (
    AdsbdbBadResponseError,
    AdsbdbInvalidDataError,
    AdsbdbRateLimitedError,
    AdsbdbTimeoutError,
    AdsbdbUnreachableError,
)

BASE_URL = "https://api.adsbdb.com/v0"
REQUEST_TIMEOUT_SECONDS = 10.0


class AdsbdbClient:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None):
        self._transport = transport  # tests inject a mock; None means real network

    async def fetch_flightroute(self, callsign: str) -> dict[str, Any] | None:
        """Raw route data for a callsign, or None if adsbdb does not know it."""
        body = await self._get(f"/callsign/{callsign}")
        return self._unwrap(body, "flightroute")

    async def fetch_aircraft(self, icao24: str) -> dict[str, Any] | None:
        """Raw aircraft data for a Mode-S hex address, or None if adsbdb does not know it."""
        body = await self._get(f"/aircraft/{icao24}")
        return self._unwrap(body, "aircraft")

    async def _get(self, path: str) -> dict[str, Any] | None:
        try:
            async with httpx.AsyncClient(
                timeout=REQUEST_TIMEOUT_SECONDS, transport=self._transport
            ) as http:
                response = await http.get(BASE_URL + path)
        except httpx.TimeoutException:
            raise AdsbdbTimeoutError() from None
        except httpx.HTTPError:
            raise AdsbdbUnreachableError() from None

        if response.status_code == 404:
            return None
        if response.status_code == 429:
            retry = response.headers.get("Retry-After")
            raise AdsbdbRateLimitedError(
                headers={"Retry-After": retry} if retry and retry.isdigit() else None
            )
        if response.status_code != 200:
            raise AdsbdbBadResponseError(f"adsbdb returned HTTP {response.status_code}")
        try:
            data = response.json()
        except ValueError:
            raise AdsbdbInvalidDataError("adsbdb returned a non-JSON body") from None
        if not isinstance(data, dict):
            raise AdsbdbInvalidDataError("adsbdb returned an unexpected JSON structure")
        return data

    @staticmethod
    def _unwrap(body: dict[str, Any] | None, key: str) -> dict[str, Any] | None:
        """adsbdb wraps results as {"response": {<key>: {...}}}."""
        if body is None:
            return None
        inner = body.get("response")
        if not isinstance(inner, dict) or not isinstance(inner.get(key), dict):
            raise AdsbdbInvalidDataError()
        return inner[key]
