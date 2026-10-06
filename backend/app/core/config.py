"""Runtime configuration, read from environment variables (optionally via a .env file)."""

import os

from dotenv import load_dotenv

load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


# Origins allowed to call the API from a browser. Defaults to the Vite dev server.
ALLOWED_ORIGINS: list[str] = _split_csv(
    os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
)

# How long (seconds) an OpenSky response is reused for the same bounding box.
CACHE_TTL_SECONDS: float = float(os.getenv("CACHE_TTL_SECONDS", "5"))

# Optional OpenSky OAuth2 client credentials. Without them, anonymous (reduced) limits apply.
OPENSKY_CLIENT_ID: str | None = os.getenv("OPENSKY_CLIENT_ID") or None
OPENSKY_CLIENT_SECRET: str | None = os.getenv("OPENSKY_CLIENT_SECRET") or None

# How long (seconds) to remember that adsbdb has no data for a callsign / aircraft.
DETAILS_UNKNOWN_TTL_SECONDS: float = float(os.getenv("DETAILS_UNKNOWN_TTL_SECONDS", "3600"))

# How long (seconds) aircraft details (type, registration, owner, photo) are cached.
AIRCRAFT_INFO_TTL_SECONDS: float = float(os.getenv("AIRCRAFT_INFO_TTL_SECONDS", "86400"))
