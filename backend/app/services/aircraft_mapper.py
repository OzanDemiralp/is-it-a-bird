"""Maps OpenSky's array-of-arrays state vectors into typed Aircraft models."""

from typing import Any

from pydantic import ValidationError

from ..core.errors import OpenSkyInvalidDataError
from ..schemas.aircraft import Aircraft, AircraftResponse

# Index of each field inside an OpenSky state-vector row (see docs, "Response").
ICAO24, CALLSIGN, LAST_CONTACT = 0, 1, 4
LON, LAT, BARO_ALT, ON_GROUND, VELOCITY, TRUE_TRACK, VERTICAL_RATE = 5, 6, 7, 8, 9, 10, 11
GEO_ALT = 13
MIN_ROW_LENGTH = GEO_ALT + 1


def _clean_callsign(value: str | None) -> str | None:
    value = (value or "").strip()  # OpenSky pads callsigns with spaces
    return value or None


def map_states(raw: dict[str, Any]) -> AircraftResponse:
    """States without a position are skipped, since they cannot be placed in the sky.

    Raises OpenSkyInvalidDataError if the payload does not have the documented shape.
    """
    try:
        rows = raw.get("states") or []  # `states` is null when the box is empty
        aircraft: list[Aircraft] = []
        for row in rows:
            if len(row) < MIN_ROW_LENGTH:
                raise OpenSkyInvalidDataError("OpenSky state vector is shorter than documented")
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
    except OpenSkyInvalidDataError:
        raise
    except (TypeError, AttributeError, ValidationError):
        raise OpenSkyInvalidDataError() from None
