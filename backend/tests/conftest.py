"""Shared test data and fixtures."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_aircraft_service, get_details_service
from app.main import app

# Row layout follows the OpenSky docs (index 0..17).
FULL_ROW = [
    "4b1805", "SWR123  ", "Switzerland", 1700000000, 1700000001,
    8.55, 47.45, 3000.0, False, 120.5, 270.0, -2.5, None, 3100.0, "1000", False, 0, 3,
]
# No callsign, no velocity/track/vrate, no geometric altitude (falls back to baro).
SPARSE_ROW = [
    "abc9f3", None, "Germany", None, 1700000002,
    8.6, 47.5, 900.0, True, None, None, None, None, None, None, False, 0, 0,
]
# No position at all: must be skipped.
NO_POSITION_ROW = [
    "def456", "LOST", "France", None, 1700000003,
    None, None, None, False, None, None, None, None, None, None, False, 0, 0,
]

# Real adsbdb response shapes (trimmed), captured from https://api.adsbdb.com/v0/...
ROUTE_JSON = {
    "callsign": "SWR123",
    "callsign_icao": "SWR123",
    "callsign_iata": "LX123",
    "airline": {
        "name": "Swiss International Air Lines",
        "icao": "SWR",
        "iata": "LX",
        "country": "Switzerland",
        "country_iso": "CH",
        "callsign": "SWISS",
    },
    "origin": {
        "country_iso_name": "KR",
        "country_name": "South Korea",
        "elevation": 23,
        "iata_code": "ICN",
        "icao_code": "RKSI",
        "latitude": 37.46910095214844,
        "longitude": 126.45099639892578,
        "municipality": "Seoul",
        "name": "Incheon International Airport",
    },
    "destination": {
        "country_iso_name": "CH",
        "country_name": "Switzerland",
        "elevation": 1417,
        "iata_code": "ZRH",
        "icao_code": "LSZH",
        "latitude": 47.458056,
        "longitude": 8.548056,
        "municipality": "Zurich",
        "name": "Zurich Airport",
    },
}

AIRCRAFT_JSON = {
    "type": "C Series 300",
    "icao_type": "BCS3",
    "manufacturer": "Bombardier",
    "mode_s": "4B1805",
    "registration": "HB-JCN",
    "registered_owner_country_iso_name": "CH",
    "registered_owner_country_name": "Switzerland",
    "registered_owner_operator_flag_code": "SWR",
    "registered_owner": "Swiss International Air Lines",
    "url_photo": "https://image.airport-data.com/aircraft/001547147.jpg",
    "url_photo_thumbnail": "https://airport-data.com/images/aircraft/thumbnails/001/547/001547147.jpg",
}


class FakeService:
    """Stands in for AircraftService at the API layer. Either returns or raises `outcome`."""

    def __init__(self, outcome):
        self.outcome = outcome

    async def get_nearby(self, lat, lon, radius_km):
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


@pytest.fixture
def api():
    """Returns a function: api(outcome) -> TestClient whose service returns/raises outcome."""

    def make(outcome) -> TestClient:
        app.dependency_overrides[get_aircraft_service] = lambda: FakeService(outcome)
        # raise_server_exceptions=False so the 500 handler is exercised like in production.
        return TestClient(app, raise_server_exceptions=False)

    yield make
    app.dependency_overrides.clear()


class FakeDetailsService:
    """Stands in for DetailsService at the API layer. Records calls; returns or raises `outcome`."""

    def __init__(self, outcome):
        self.outcome = outcome
        self.calls: list[tuple] = []

    async def get_details(self, icao24, callsign, lat=None, lon=None, velocity=None):
        self.calls.append((icao24, callsign, lat, lon, velocity))
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


@pytest.fixture
def details_api():
    """Returns a function: details_api(outcome) -> (TestClient, FakeDetailsService)."""

    def make(outcome):
        service = FakeDetailsService(outcome)
        app.dependency_overrides[get_details_service] = lambda: service
        return TestClient(app, raise_server_exceptions=False), service

    yield make
    app.dependency_overrides.clear()
