import pytest

from app.core.errors import OpenSkyInvalidDataError
from app.services.aircraft_mapper import map_states
from tests.conftest import FULL_ROW, NO_POSITION_ROW, SPARSE_ROW


def test_maps_fields_and_handles_nulls():
    result = map_states({"time": 9, "states": [FULL_ROW, SPARSE_ROW, NO_POSITION_ROW]})
    assert result.count == 2  # the row without a position is dropped

    full, sparse = result.aircraft
    assert full.callsign == "SWR123"  # padding stripped
    assert full.altitude == 3100.0  # geometric altitude preferred
    assert full.heading == 270.0
    assert full.vertical_rate == -2.5
    assert sparse.callsign is None
    assert sparse.altitude == 900.0  # fell back to barometric
    assert sparse.velocity is None
    assert sparse.on_ground is True


def test_null_states_means_empty_list():
    assert map_states({"time": 1, "states": None}).aircraft == []


def test_short_row_raises_invalid_data():
    with pytest.raises(OpenSkyInvalidDataError):
        map_states({"time": 1, "states": [["abc", None]]})


def test_wrongly_typed_row_raises_invalid_data():
    with pytest.raises(OpenSkyInvalidDataError):
        map_states({"time": 1, "states": ["not-a-row"]})


def test_wrongly_typed_field_raises_invalid_data():
    bad = list(FULL_ROW)
    bad[5] = "not-a-number"  # longitude
    with pytest.raises(OpenSkyInvalidDataError):
        map_states({"time": 1, "states": [bad]})
