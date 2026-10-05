import math

from ..schemas.geo import BoundingBox

KM_PER_DEG_LAT = 111.32
BBOX_DECIMALS = 2  # ~1 km; coarse enough that nearby requests share a cache entry


def bounding_box(lat: float, lon: float, radius_km: float) -> BoundingBox:
    """Square lat/lon box around a point, rounded so close-by requests share a cache key.

    1 degree of latitude is ~111.32 km everywhere; 1 degree of longitude shrinks by cos(lat).
    The box is clamped to valid ranges; it does not wrap across the antimeridian.
    """
    dlat = radius_km / KM_PER_DEG_LAT
    dlon = radius_km / (KM_PER_DEG_LAT * max(math.cos(math.radians(lat)), 0.01))
    return BoundingBox(
        lamin=round(max(lat - dlat, -90.0), BBOX_DECIMALS),
        lomin=round(max(lon - dlon, -180.0), BBOX_DECIMALS),
        lamax=round(min(lat + dlat, 90.0), BBOX_DECIMALS),
        lomax=round(min(lon + dlon, 180.0), BBOX_DECIMALS),
    )
