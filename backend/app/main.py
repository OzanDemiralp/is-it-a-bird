from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import config, opensky
from .cache import TTLCache
from .models import AircraftResponse

app = FastAPI(title="Is It A Bird? API")

# No cookies/credentials are used, so credentials stay off; only GET is needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

cache: TTLCache[AircraftResponse] = TTLCache(config.CACHE_TTL_SECONDS)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "is-it-a-bird-api"}


@app.get("/aircraft", response_model=AircraftResponse)
async def get_aircraft(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=50, gt=0, le=250),
):
    box = opensky.bounding_box(lat, lon, radius_km)

    cached = cache.get(box)
    if cached is not None:
        return cached

    try:
        raw = await opensky.fetch_states(box)
        result = opensky.parse_states(raw)
    except opensky.OpenSkyError as exc:
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        raise HTTPException(status_code=exc.status_code, detail=exc.message, headers=headers)
    except (IndexError, TypeError, ValueError, KeyError):
        raise HTTPException(status_code=502, detail="Unexpected data format from OpenSky")

    cache.set(box, result)
    return result