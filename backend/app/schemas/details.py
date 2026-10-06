"""Response models for the route / aircraft-details endpoint. Missing data is None."""

from pydantic import BaseModel


class Airport(BaseModel):
    name: str | None = None
    city: str | None = None
    iata: str | None = None
    icao: str | None = None
    country: str | None = None
    lat: float | None = None
    lon: float | None = None


class Airline(BaseModel):
    name: str | None = None
    iata: str | None = None
    icao: str | None = None
    country: str | None = None


class FlightRoute(BaseModel):
    callsign: str
    airline: Airline | None = None
    origin: Airport | None = None
    destination: Airport | None = None


class AircraftInfo(BaseModel):
    type: str | None = None  # e.g. "C Series 300"
    icao_type: str | None = None  # e.g. "BCS3"
    manufacturer: str | None = None
    registration: str | None = None
    owner: str | None = None
    owner_country: str | None = None
    photo_url: str | None = None
    photo_thumbnail_url: str | None = None


class AircraftDetails(BaseModel):
    """Either part is None when adsbdb has no data for it (that is normal, not an error)."""

    route: FlightRoute | None = None
    aircraft: AircraftInfo | None = None
