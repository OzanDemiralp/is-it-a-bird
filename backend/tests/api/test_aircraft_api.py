"""API layer: HTTP behaviour and the global error shape. The service is faked."""

import pytest

from app.core import errors
from app.schemas.aircraft import AircraftResponse

PARAMS = {"lat": 47.45, "lon": 8.55, "radius_km": 20}

ERROR_CASES = [
    (errors.OpenSkyRateLimitedError(), 429, "OPENSKY_RATE_LIMITED", "OpenSkyRateLimitedError"),
    (errors.OpenSkyTimeoutError(), 504, "OPENSKY_TIMEOUT", "OpenSkyTimeoutError"),
    (errors.OpenSkyUnreachableError(), 502, "OPENSKY_UNREACHABLE", "OpenSkyUnreachableError"),
    (errors.OpenSkyBadResponseError(), 502, "OPENSKY_BAD_RESPONSE", "OpenSkyBadResponseError"),
    (errors.OpenSkyInvalidDataError(), 502, "OPENSKY_INVALID_DATA", "OpenSkyInvalidDataError"),
    (errors.OpenSkyAuthError(), 502, "OPENSKY_AUTH_FAILED", "OpenSkyAuthError"),
]


def test_success_returns_service_result(api):
    result = AircraftResponse(time=1, count=0, aircraft=[])
    resp = api(result).get("/aircraft", params=PARAMS)
    assert resp.status_code == 200
    assert resp.json() == {"time": 1, "count": 0, "aircraft": []}


@pytest.mark.parametrize("error,status,code,name", ERROR_CASES)
def test_app_errors_use_flat_shape(api, error, status, code, name):
    resp = api(error).get("/aircraft", params=PARAMS)
    assert resp.status_code == status
    assert resp.json() == {"code": code, "name": name, "message": error.message}


def test_rate_limit_error_forwards_retry_after_header(api):
    error = errors.OpenSkyRateLimitedError(headers={"Retry-After": "42"})
    resp = api(error).get("/aircraft", params=PARAMS)
    assert resp.headers["retry-after"] == "42"


def test_invalid_params_become_validation_error(api):
    resp = api(None).get("/aircraft", params={"lat": 100, "lon": 0})
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "REQUEST_VALIDATION_FAILED"
    assert body["name"] == "RequestValidationFailedError"
    assert body["details"][0]["field"] == "lat"


def test_missing_params_become_validation_error(api):
    resp = api(None).get("/aircraft")
    assert resp.status_code == 422
    assert {d["field"] for d in resp.json()["details"]} == {"lat", "lon"}


def test_unknown_route_uses_error_shape(api):
    resp = api(None).get("/nope")
    assert resp.status_code == 404
    assert resp.json()["code"] == "RESOURCE_NOT_FOUND"


def test_wrong_method_uses_error_shape(api):
    resp = api(None).post("/aircraft", params=PARAMS)
    assert resp.status_code == 405
    assert resp.json()["code"] == "METHOD_NOT_ALLOWED"


def test_unexpected_exception_returns_500_without_leaking(api):
    resp = api(RuntimeError("secret internal detail")).get("/aircraft", params=PARAMS)
    assert resp.status_code == 500
    assert resp.json() == {
        "code": "INTERNAL_ERROR",
        "name": "InternalServerError",
        "message": "Internal server error",
    }


def test_health(api):
    resp = api(None).get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
