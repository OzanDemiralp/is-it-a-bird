from pydantic import BaseModel


class Aircraft(BaseModel):
    """One aircraft state. Any measurement OpenSky did not provide is None."""

    icao24: str
    callsign: str | None = None
    lat: float
    lon: float
    altitude: float | None = None  # meters; geometric if available, else barometric
    velocity: float | None = None  # ground speed, m/s
    heading: float | None = None  # true track, degrees clockwise from north
    vertical_rate: float | None = None  # m/s, positive = climbing
    on_ground: bool
    last_contact: int  # Unix timestamp (seconds)


class AircraftResponse(BaseModel):
    time: int  # OpenSky's timestamp for this snapshot
    count: int
    aircraft: list[Aircraft]
