"""Thin client for the OpenSky Network `GET /states/all` endpoint.

Docs: https://openskynetwork.github.io/opensky-api/rest.html
"""

import math
import time
from typing import Any

import httpx

from . import config
from .models import Aircraft, AircraftResponse

STATES_URL = "https://opensky-network.org/api/states/all"
TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
)

# Index of each field inside an OpenSky state-vector row (see docs, "Response").
ICAO24, CALLSIGN, _ORIGIN, _TIME_POS, LAST_CONTACT = 0, 1, 2, 3, 4
LON, LAT, BARO_ALT, ON_GROUND, VELOCITY, TRUE_TRACK, VERTICAL_RATE = 5, 6, 7, 8, 9, 10, 11
GEO_ALT = 13

KM_PER_DEG_LAT = 111.32
BBOX_DECIMALS = 2  # ~1 km; coarse enough that nearby requests share a cache entry

BBox = tuple[float, float, float, float]  # lamin, lomin, lamax, lomax


class OpenSkyError(Exception):
    """OpenSky could not give us data. `status_code` is what our API should return."""

    def __init__(self, status_code: int, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.retry_after = retry_after


def bounding_box(lat: float, lon: float, radius_km: float) -> BBox:
    """Square lat/lon box around a point, rounded so close-by requests share a cache key.

    1 degree of latitude is ~111.32 km everywhere; 1 degree of longitude shrinks by cos(lat).
    The box is clamped to valid ranges; it does not wrap across the antimeridian.
    """
    dlat = radius_km / KM_PER_DEG_LAT
    dlon = radius_km / (KM_PER_DEG_LAT * max(math.cos(math.radians(lat)), 0.01))
    box = (
        max(lat - dlat, -90.0),
        max(lon - dlon, -180.0),
        min(lat + dlat, 90.0),
        min(lon + dlon, 180.0),
    )
    return tuple(round(v, BBOX_DECIMALS) for v in box)  # type: ignore[return-value]


# --- auth (optional) -------------------------------------------------------------------------

_token: str | None = None
_token_expires_at: float = 0.0


async def _auth_headers(client: httpx.AsyncClient) -> dict[str, str]:
    """Bearer header if credentials are configured, otherwise no auth (anonymous)."""
    global _token, _token_expires_at
    if not (config.OPENSKY_CLIENT_ID and config.OPENSKY_CLIENT_SECRET):
        return {}
    if _token is None or time.monotonic() >= _token_expires_at:
        resp = await client.post(
            TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": config.OPENSKY_CLIENT_ID,
                "client_secret": config.OPENSKY_CLIENT_SECRET,
            },
        )
        resp.raise_for_status()
        body = resp.json()
        _token = body["access_token"]
        # Refresh 30 s early; tokens last 30 min by default.
        _token_expires_at = time.monotonic() + body.get("expires_in", 1800) - 30
    return {"Authorization": f"Bearer {_token}"}


# --- fetching --------------------------------------------------------------------------------


async def fetch_states(box: BBox) -> dict[str, Any]:
    """Call OpenSky and return the decoded JSON. Raises OpenSkyError on any failure."""
    lamin, lomin, lamax, lomax = box
    params = {"lamin": lamin, "lomin": lomin, "lamax": lamax, "lomax": lomax}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = await _auth_headers(client)
            resp = await client.get(STATES_URL, params=params, headers=headers)
    except httpx.TimeoutException:
        raise OpenSkyError(504, "OpenSky timed out") from None
    except httpx.HTTPError:
        raise OpenSkyError(502, "Could not reach OpenSky") from None

    if resp.status_code == 429:
        retry = resp.headers.get("X-Rate-Limit-Retry-After-Seconds")
        raise OpenSkyError(
            429,
            "OpenSky rate limit reached",
            retry_after=int(retry) if retry and retry.isdigit() else None,
        )
    if resp.status_code != 200:
        raise OpenSkyError(502, f"OpenSky returned HTTP {resp.status_code}")
    try:
        return resp.json()
    except ValueError:
        raise OpenSkyError(502, "OpenSky returned invalid JSON") from None


# --- parsing ---------------------------------------------------------------------------------


def _clean_callsign(value: str | None) -> str | None:
    value = (value or "").strip()  # OpenSky pads callsigns with spaces
    return value or None


def parse_states(raw: dict[str, Any]) -> AircraftResponse:
    """Map OpenSky's array-of-arrays into typed models.

    States without a position are skipped, since they cannot be placed in the sky.
    """
    aircraft: list[Aircraft] = []
    for row in raw.get("states") or []:  # `states` is null when the box is empty
        if row[LAT] is None or row[LON] is None:
            continue
        altitude = row[GEO_ALT] if row[GEO_ALT] is not None else row[BARO_ALT]
        aircraft.append(
            Aircraft(
                icao24=row[ICAO24],
                callsign=_clean_callsign(row[CALLSIGN]),
                lat=row[LAT],
                lon=row[LON],
                altitude=altitude,
                velocity=row[VELOCITY],
                heading=row[TRUE_TRACK],
                vertical_rate=row[VERTICAL_RATE],
                on_ground=bool(row[ON_GROUND]),
                last_contact=row[LAST_CONTACT],
            )
        )
    return AircraftResponse(time=raw.get("time", 0), count=len(aircraft), aircraft=aircraft)
