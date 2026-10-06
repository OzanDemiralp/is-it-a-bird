"""Maps adsbdb's raw JSON into our Pydantic models."""

from typing import Any

from pydantic import ValidationError

from ..core.errors import AdsbdbInvalidDataError
from ..schemas.details import AircraftInfo, Airline, Airport, FlightRoute


def _airport(raw: Any) -> Airport | None:
    if not isinstance(raw, dict):
        return None
    return Airport(
        name=raw.get("name"),
        city=raw.get("municipality"),
        iata=raw.get("iata_code"),
        icao=raw.get("icao_code"),
        country=raw.get("country_name"),
        lat=raw.get("latitude"),
        lon=raw.get("longitude"),
    )


def _airline(raw: Any) -> Airline | None:
    if not isinstance(raw, dict):
        return None
    return Airline(
        name=raw.get("name"),
        iata=raw.get("iata"),
        icao=raw.get("icao"),
        country=raw.get("country"),
    )


def map_flightroute(raw: dict[str, Any]) -> FlightRoute:
    try:
        return FlightRoute(
            callsign=raw["callsign"],
            airline=_airline(raw.get("airline")),
            origin=_airport(raw.get("origin")),
            destination=_airport(raw.get("destination")),
        )
    except (KeyError, TypeError, ValidationError):
        raise AdsbdbInvalidDataError() from None


def map_aircraft(raw: dict[str, Any]) -> AircraftInfo:
    try:
        return AircraftInfo(
            type=raw.get("type"),
            icao_type=raw.get("icao_type"),
            manufacturer=raw.get("manufacturer"),
            registration=raw.get("registration"),
            owner=raw.get("registered_owner"),
            owner_country=raw.get("registered_owner_country_name"),
            photo_url=raw.get("url_photo"),
            photo_thumbnail_url=raw.get("url_photo_thumbnail"),
        )
    except (TypeError, ValidationError):
        raise AdsbdbInvalidDataError() from None
