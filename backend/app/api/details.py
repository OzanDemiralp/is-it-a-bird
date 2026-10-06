from fastapi import APIRouter, Depends, Path, Query

from ..schemas.details import AircraftDetails
from ..services.details_service import DetailsService
from .dependencies import get_details_service

router = APIRouter()


@router.get("/aircraft/{icao24}/details", response_model=AircraftDetails)
async def get_aircraft_details(
    icao24: str = Path(pattern=r"^[0-9a-fA-F]{6}$"),
    callsign: str | None = Query(default=None, max_length=8, pattern=r"^[0-9A-Za-z]*$"),
    # Optional current position and ground speed (m/s): used only to size the route cache TTL.
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    velocity: float | None = Query(default=None, ge=0),
    service: DetailsService = Depends(get_details_service),
) -> AircraftDetails:
    return await service.get_details(icao24, callsign, lat, lon, velocity)
