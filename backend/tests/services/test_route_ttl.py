"""Route-cache TTL math. Every expected value below is derived by hand in the comments."""

import math

import pytest

from app.services import route_ttl
from app.services.route_ttl import (
    FALLBACK_TTL_SECONDS,
    MAX_TTL_SECONDS,
    MIN_TTL_SECONDS,
    great_circle_distance_m,
    route_ttl_seconds,
)

R = route_ttl.EARTH_RADIUS_M


def test_distance_is_zero_for_the_same_point():
    assert great_circle_distance_m(10, 20, 10, 20) == pytest.approx(0, abs=1e-6)


def test_distance_along_the_equator_is_arc_length():
    # 90 degrees of arc on a sphere of radius R is (pi / 2) * R.
    assert great_circle_distance_m(0, 0, 0, 90) == pytest.approx(math.pi / 2 * R, rel=1e-9)


def test_distance_pole_to_equator_is_a_quarter_circle():
    assert great_circle_distance_m(90, 0, 0, 0) == pytest.approx(math.pi / 2 * R, rel=1e-9)


def test_ttl_is_remaining_flight_time_plus_margin():
    # 1 degree of longitude on the equator = (pi / 180) * R = 111194.93 m.
    # At 250 m/s that is 444.78 s; with the 25% margin: 444.78 * 1.25 = 555.97 s.
    ttl = route_ttl_seconds(0, 0, 250, 0, 1)
    assert ttl == pytest.approx(111194.93 / 250 * 1.25, rel=1e-6)
    assert ttl == pytest.approx(555.97, abs=0.01)


def test_ttl_is_clamped_to_the_minimum():
    # 0.1 degree = 11119 m; at 250 m/s with margin = 55.6 s, which is below the 5 minute floor.
    assert route_ttl_seconds(0, 0, 250, 0, 0.1) == MIN_TTL_SECONDS


def test_ttl_is_clamped_to_the_maximum():
    # Quarter of the equator (10,007,543 m) at 60 m/s with margin = ~208,490 s, above 12 h.
    assert route_ttl_seconds(0, 0, 60, 0, 90) == MAX_TTL_SECONDS


@pytest.mark.parametrize(
    "args",
    [
        (None, 0, 250, 0, 1),  # no aircraft latitude
        (0, None, 250, 0, 1),  # no aircraft longitude
        (0, 0, None, 0, 1),  # no speed
        (0, 0, 250, None, 1),  # no destination latitude
        (0, 0, 250, 0, None),  # no destination longitude
        (0, 0, 49.9, 0, 1),  # too slow to be cruising (taxi / take-off / landing)
        (0, 0, 0, 0, 1),  # stationary
    ],
)
def test_missing_or_unreliable_inputs_use_the_fallback(args):
    assert route_ttl_seconds(*args) == FALLBACK_TTL_SECONDS


def test_speed_exactly_at_the_threshold_is_trusted():
    assert route_ttl_seconds(0, 0, 50.0, 0, 1) != FALLBACK_TTL_SECONDS
