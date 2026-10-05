from fastapi import APIRouter, Depends, Query

from ..schemas.aircraft import AircraftResponse
from ..services.aircraft_service import AircraftService
from .dependencies import get_aircraft_service

router = APIRouter()


@router.get("/aircraft", response_model=AircraftResponse)
async def get_aircraft(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=50, gt=0, le=250),
    service: AircraftService = Depends(get_aircraft_service),
) -> AircraftResponse:
    return await service.get_nearby(lat, lon, radius_km)
