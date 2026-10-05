from dataclasses import dataclass


@dataclass(frozen=True)
class BoundingBox:
    """WGS84 lat/lon box. Frozen so it is hashable and usable as a cache key."""

    lamin: float
    lomin: float
    lamax: float
    lomax: float
