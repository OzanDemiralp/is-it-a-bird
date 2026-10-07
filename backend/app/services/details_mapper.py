"""Maps adsbdb's raw JSON into our Pydantic models."""

from typing import Any

from pydantic import ValidationError

from ..core.errors import AdsbdbInvalidDataError
from ..schemas.details import AircraftInfo, Airline, Airport, FlightRoute


def _empty_to_none(val: Any) -> Any:
    if val == "":
        return None
    return val


def _airport(raw: Any) -> Airport | None:
    if not isinstance(raw, dict):
        return None
    lat = _empty_to_none(raw.get("latitude"))
    lon = _empty_to_none(raw.get("longitude"))
    return Airport(
        name=_empty_to_none(raw.get("name")),
        city=_empty_to_none(raw.get("municipality")),
        iata=_empty_to_none(raw.get("iata_code")),
        icao=_empty_to_none(raw.get("icao_code")),
        country=_empty_to_none(raw.get("country_name")),
        lat=lat,
        lon=lon,
    )


def _airline(raw: Any) -> Airline | None:
    if not isinstance(raw, dict):
        return None
    return Airline(
        name=_empty_to_none(raw.get("name")),
        iata=_empty_to_none(raw.get("iata")),
        icao=_empty_to_none(raw.get("icao")),
        country=_empty_to_none(raw.get("country")),
    )


def map_flightroute(raw: dict[str, Any]) -> FlightRoute:
    if not isinstance(raw, dict):
        raise AdsbdbInvalidDataError()
    try:
        return FlightRoute(
            callsign=_empty_to_none(raw.get("callsign")),
            airline=_airline(raw.get("airline")),
            origin=_airport(raw.get("origin")),
            destination=_airport(raw.get("destination")),
        )
    except (TypeError, ValidationError):
        raise AdsbdbInvalidDataError() from None


def map_aircraft(raw: dict[str, Any]) -> AircraftInfo:
    if not isinstance(raw, dict):
        raise AdsbdbInvalidDataError()
    try:
        return AircraftInfo(
            type=_empty_to_none(raw.get("type")),
            icao_type=_empty_to_none(raw.get("icao_type")),
            manufacturer=_empty_to_none(raw.get("manufacturer")),
            registration=_empty_to_none(raw.get("registration")),
            owner=_empty_to_none(raw.get("registered_owner")),
            owner_country=_empty_to_none(raw.get("registered_owner_country_name")),
            photo_url=_empty_to_none(raw.get("url_photo")),
            photo_thumbnail_url=_empty_to_none(raw.get("url_photo_thumbnail")),
        )
    except (TypeError, ValidationError):
        raise AdsbdbInvalidDataError() from None
