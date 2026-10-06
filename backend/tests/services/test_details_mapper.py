import pytest

from app.core.errors import AdsbdbInvalidDataError
from app.services.details_mapper import map_aircraft, map_flightroute
from tests.conftest import AIRCRAFT_JSON, ROUTE_JSON


def test_maps_full_route():
    route = map_flightroute(ROUTE_JSON)
    assert route.callsign == "SWR123"
    assert route.airline.name == "Swiss International Air Lines"
    assert route.airline.iata == "LX"
    assert route.origin.iata == "ICN"
    assert route.origin.city == "Seoul"
    assert route.origin.name == "Incheon International Airport"
    assert route.destination.icao == "LSZH"
    assert route.destination.lat == pytest.approx(47.458056)
    assert route.destination.lon == pytest.approx(8.548056)


def test_route_tolerates_missing_parts():
    route = map_flightroute({"callsign": "ABC1", "origin": None})
    assert route.airline is None
    assert route.origin is None
    assert route.destination is None


def test_route_without_callsign_is_invalid():
    with pytest.raises(AdsbdbInvalidDataError):
        map_flightroute({"origin": {}})


def test_route_with_wrongly_typed_field_is_invalid():
    bad = {"callsign": "ABC1", "destination": {"latitude": "not-a-number"}}
    with pytest.raises(AdsbdbInvalidDataError):
        map_flightroute(bad)


def test_maps_full_aircraft():
    info = map_aircraft(AIRCRAFT_JSON)
    assert info.type == "C Series 300"
    assert info.icao_type == "BCS3"
    assert info.manufacturer == "Bombardier"
    assert info.registration == "HB-JCN"
    assert info.owner == "Swiss International Air Lines"
    assert info.owner_country == "Switzerland"
    assert info.photo_url.endswith("001547147.jpg")
    assert "thumbnails" in info.photo_thumbnail_url


def test_aircraft_tolerates_missing_fields():
    info = map_aircraft({"registration": "N123"})
    assert info.registration == "N123"
    assert info.type is None
    assert info.photo_url is None


def test_aircraft_with_wrongly_typed_field_is_invalid():
    with pytest.raises(AdsbdbInvalidDataError):
        map_aircraft({"type": {"nested": "dict"}})
