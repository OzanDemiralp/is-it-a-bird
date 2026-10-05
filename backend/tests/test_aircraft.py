from fastapi.testclient import TestClient

from app import main, opensky

client = TestClient(main.app)

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


def setup_function():
    main.cache.clear()


def test_aircraft_maps_fields_and_handles_nulls(monkeypatch):
    async def fake_fetch(box):
        return {"time": 1700000005, "states": [FULL_ROW, SPARSE_ROW, NO_POSITION_ROW]}

    monkeypatch.setattr(opensky, "fetch_states", fake_fetch)

    resp = client.get("/aircraft", params={"lat": 47.45, "lon": 8.55, "radius_km": 20})
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 2  # the row without a position is dropped

    full, sparse = body["aircraft"]
    assert full["callsign"] == "SWR123"  # padding stripped
    assert full["altitude"] == 3100.0  # geometric altitude preferred
    assert full["heading"] == 270.0
    assert full["vertical_rate"] == -2.5
    assert sparse["callsign"] is None
    assert sparse["altitude"] == 900.0  # fell back to barometric
    assert sparse["velocity"] is None
    assert sparse["on_ground"] is True


def test_empty_area_returns_empty_list(monkeypatch):
    async def fake_fetch(box):
        return {"time": 1700000005, "states": None}  # OpenSky sends null when empty

    monkeypatch.setattr(opensky, "fetch_states", fake_fetch)
    resp = client.get("/aircraft", params={"lat": 0, "lon": 0})
    assert resp.status_code == 200
    assert resp.json()["aircraft"] == []


def test_responses_are_cached_for_same_bounding_box(monkeypatch):
    calls = []

    async def fake_fetch(box):
        calls.append(box)
        return {"time": 1, "states": [FULL_ROW]}

    monkeypatch.setattr(opensky, "fetch_states", fake_fetch)
    params = {"lat": 47.45, "lon": 8.55, "radius_km": 20}
    client.get("/aircraft", params=params)
    # A few meters away rounds to the same box -> cache hit.
    client.get("/aircraft", params={**params, "lat": 47.45001})
    assert len(calls) == 1


def test_rate_limit_becomes_429_with_retry_after(monkeypatch):
    async def fake_fetch(box):
        raise opensky.OpenSkyError(429, "OpenSky rate limit reached", retry_after=42)

    monkeypatch.setattr(opensky, "fetch_states", fake_fetch)
    resp = client.get("/aircraft", params={"lat": 0, "lon": 0})
    assert resp.status_code == 429
    assert resp.headers["retry-after"] == "42"


def test_unreachable_opensky_becomes_502(monkeypatch):
    async def fake_fetch(box):
        raise opensky.OpenSkyError(502, "Could not reach OpenSky")

    monkeypatch.setattr(opensky, "fetch_states", fake_fetch)
    resp = client.get("/aircraft", params={"lat": 0, "lon": 0})
    assert resp.status_code == 502
    assert "OpenSky" in resp.json()["detail"]


def test_bounding_box_math():
    # 111.32 km radius at the equator is exactly 1 degree in each direction.
    assert opensky.bounding_box(0, 0, 111.32) == (-1.0, -1.0, 1.0, 1.0)


def test_invalid_params_rejected():
    assert client.get("/aircraft", params={"lat": 100, "lon": 0}).status_code == 422
