# Project: "Is It A Bird?" (is-it-a-bird)

## Concept
A mobile-first web app (PWA) that answers: "What is that aircraft flying over me right now?"
The user opens the app, shares their location, and points their phone at the sky. The app
fetches live ADS-B data for nearby aircraft, computes where each aircraft appears in the sky
relative to the user (azimuth, elevation, distance), and matches that against the direction
the phone is facing. Eventually it will show a label with callsign, route, and aircraft type
on top of the camera feed.

This prompt covers ONLY the first steps. Do not build the full app.

## Existing skeleton (already in the repo, do not recreate)
- /backend: FastAPI app (`app/main.py`) with CORS middleware and a `/health` endpoint,
  `requirements.txt`, a `.venv`.
- /frontend: Vite + TypeScript project (package.json, tsconfig files, eslint config, src/, public/).
- Root `.gitignore` and a `frontend/.gitignore`.
Inspect the repo first and work with what is there. Match the existing structure and style.

## Target architecture (for context)
- Frontend (TypeScript): all geometry runs client-side as pure functions, because later the
  app will extrapolate aircraft positions several times per second. Sensors (Geolocation,
  DeviceOrientation, camera) come later.
- Backend (FastAPI): a thin proxy that fetches aircraft states from OpenSky Network for a
  bounding box, caches the result for a few seconds (short TTL) to respect rate limits, and
  returns a clean typed JSON response. Credentials/config go in `.env`, never in code.

## Scope of this task (do these, in order)

### Step 1: Geometry module (frontend, no UI, no network)
Create `frontend/src/geo/` with pure, well-typed functions:
- WGS84 geodetic (lat, lon, altitude in meters) -> ECEF
- ECEF difference -> local ENU (East-North-Up) relative to an observer
- `azimuthElevation(observer, target)` returning azimuth (degrees clockwise from true north,
  normalized to 0-360), elevation (degrees above the horizon), and slant range (meters)
Set up Vitest and write unit tests with hand-verifiable cases (e.g. target directly north at
the same altitude, directly overhead, directly east, target below the horizon, and one
realistic case). Do not guess expected values; derive them and note how in the test comments.

### Step 2: Aircraft endpoint (backend)
Add `GET /aircraft?lat=&lon=&radius_km=` that:
- converts the center point and radius into a lat/lon bounding box,
- queries the OpenSky Network states API for that box (check the official docs for the current
  endpoint, parameters, state-vector field order, and anonymous rate limits; do not rely on
  memory),
- maps the result into Pydantic models (icao24, callsign, lat, lon, altitude, velocity,
  heading, vertical rate, on_ground, last contact timestamp) and handles null fields,
- caches responses in memory with a short TTL, keyed by a rounded bounding box,
- fails gracefully (clear HTTP error, no crash) when OpenSky is unavailable or rate limited.
Add a couple of tests with the OpenSky call mocked.

### Step 3: Small housekeeping
- Replace `allow_origins=["*"]` + `allow_credentials=True` with a sensible dev config
  (no credentials are used) and make allowed origins configurable via env.
- Add a Vite dev proxy so the frontend can call `/api/*` without CORS issues.
- Make sure `.venv/`, `__pycache__/`, and `.env` are git-ignored; add `.env.example`.

## Explicitly OUT of scope for now
Camera overlay, device orientation/compass handling, dead-reckoning extrapolation, route or
aircraft-type enrichment, PWA setup, deployment, auth, and any real UI beyond what is needed
to verify the above. Do not add these even as stubs.

## Working style
- Ask before adding any new dependency beyond Vitest and the minimal HTTP/test libraries.
- Keep changes small and reviewable; explain what you changed after each step.
- Prefer clarity over cleverness; I should be able to explain
  every part of it.
- Stop after Step 3 and summarize what is done and what the natural next step would be.