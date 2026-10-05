"""Shared test data and fixtures."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_aircraft_service
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
