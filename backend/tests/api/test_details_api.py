"""API layer for GET /aircraft/{icao24}/details. The service is faked."""

import pytest

from app.core import errors
from app.schemas.details import AircraftDetails, AircraftInfo, FlightRoute

FOUND = AircraftDetails(
    route=FlightRoute(callsign="SWR123"),
    aircraft=AircraftInfo(registration="HB-JCN"),
)
ADSBDB_ERRORS = [
    (errors.AdsbdbRateLimitedError(), 429, "ADSBDB_RATE_LIMITED", "AdsbdbRateLimitedError"),
    (errors.AdsbdbTimeoutError(), 504, "ADSBDB_TIMEOUT", "AdsbdbTimeoutError"),
    (errors.AdsbdbUnreachableError(), 502, "ADSBDB_UNREACHABLE", "AdsbdbUnreachableError"),
    (errors.AdsbdbBadResponseError(), 502, "ADSBDB_BAD_RESPONSE", "AdsbdbBadResponseError"),
    (errors.AdsbdbInvalidDataError(), 502, "ADSBDB_INVALID_DATA", "AdsbdbInvalidDataError"),
]


def test_returns_details(details_api):
    client, service = details_api(FOUND)
    resp = client.get("/aircraft/4b1805/details", params={"callsign": "SWR123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["route"]["callsign"] == "SWR123"
    assert body["aircraft"]["registration"] == "HB-JCN"
    assert service.calls == [("4b1805", "SWR123", None, None, None)]


def test_unknown_data_is_200_with_nulls_not_an_error(details_api):
    client, _ = details_api(AircraftDetails())
    resp = client.get("/aircraft/4b1805/details")
    assert resp.status_code == 200
    assert resp.json() == {"route": None, "aircraft": None}


def test_partial_details_returns_200_with_available_data(details_api):
    client, _ = details_api(AircraftDetails(aircraft=AircraftInfo(registration="HB-JCN")))
    resp = client.get("/aircraft/4b1805/details")
    assert resp.status_code == 200
    assert resp.json() == {
        "route": None,
        "aircraft": {
            "type": None,
            "icao_type": None,
            "manufacturer": None,
            "registration": "HB-JCN",
            "owner": None,
            "owner_country": None,
            "photo_url": None,
            "photo_thumbnail_url": None,
        },
    }


def test_passes_position_and_speed_through(details_api):
    client, service = details_api(FOUND)
    client.get(
        "/aircraft/4b1805/details",
        params={"callsign": "SWR123", "lat": 48.0, "lon": 9.0, "velocity": 230.5},
    )
    assert service.calls == [("4b1805", "SWR123", 48.0, 9.0, 230.5)]


@pytest.mark.parametrize("error,status,code,name", ADSBDB_ERRORS)
def test_adsbdb_failures_use_the_flat_error_shape(details_api, error, status, code, name):
    client, _ = details_api(error)
    resp = client.get("/aircraft/4b1805/details", params={"callsign": "SWR123"})
    assert resp.status_code == status
    assert resp.json() == {"code": code, "name": name, "message": error.message}


def test_rate_limit_forwards_retry_after(details_api):
    client, _ = details_api(errors.AdsbdbRateLimitedError(headers={"Retry-After": "15"}))
    resp = client.get("/aircraft/4b1805/details")
    assert resp.headers["retry-after"] == "15"


@pytest.mark.parametrize(
    "path,params,field",
    [
        ("/aircraft/xyz/details", {}, "icao24"),  # not 6 hex characters
        ("/aircraft/4b18055/details", {}, "icao24"),  # too long
        ("/aircraft/4b1805/details", {"callsign": "TOOLONG123"}, "callsign"),
        ("/aircraft/4b1805/details", {"callsign": "AB/../1"}, "callsign"),
        ("/aircraft/4b1805/details", {"lat": 91}, "lat"),
        ("/aircraft/4b1805/details", {"lon": -181}, "lon"),
        ("/aircraft/4b1805/details", {"velocity": -1}, "velocity"),
    ],
)
def test_invalid_input_is_a_validation_error(details_api, path, params, field):
    client, service = details_api(FOUND)
    resp = client.get(path, params=params)
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "REQUEST_VALIDATION_FAILED"
    assert field in {d["field"] for d in body["details"]}
    assert service.calls == []


def test_unexpected_exception_returns_500_without_leaking(details_api):
    client, _ = details_api(RuntimeError("secret"))
    resp = client.get("/aircraft/4b1805/details")
    assert resp.status_code == 500
    assert resp.json()["code"] == "INTERNAL_ERROR"
    assert "secret" not in resp.text
