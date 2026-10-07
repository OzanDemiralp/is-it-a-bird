# Task: Device orientation (sensor) layer for "Is It A Bird?"

## Context
This project is a mobile-first web app that tells the user which aircraft they are pointing
their phone at. The backend (FastAPI) and the geometry/ranking logic on the frontend
(`geo/`, `skyService`, `candidateService`) already exist and are tested. What is missing is
the part that tells the app **where the phone is pointing**.

Inspect the repo first and follow its existing structure, naming, and testing style.

The goal of this task is to build the sensor layer so that all device-specific behavior
(iOS vs Android, permissions, compass quirks) is isolated in one place, and everything else
in the app only sees a clean, device-independent pose.

## Core design

### 1. A single abstraction: `OrientationProvider`
Create a module (e.g. `frontend/src/sensors/`) exposing an interface roughly like:

- `start()` / `stop()`
- `subscribe(callback)` that emits a **camera pointing direction**:
  - `azimuthDeg`: degrees clockwise from **true north**, 0-360
  - `elevationDeg`: degrees above the horizon, -90 to 90
  - `timestamp`
  - optional `accuracyHint` (if the platform provides one)

The rest of the app must not know which platform produced the values.

### 2. Implementations behind that interface
- **iOS provider:** needs the explicit permission request
  (`DeviceOrientationEvent.requestPermission()`, which must be triggered by a user gesture)
  and its own way of reading compass heading.
- **Android / absolute provider:** uses the absolute orientation event.
- **Fake provider:** emits scripted or manually controlled values, for tests and for
  desktop development.
- A small factory that picks the right one at runtime and reports a clear status
  when sensors are unavailable or permission is denied.

Do not rely on memory for the exact event names, fields, and permission flow on each
platform. Check current MDN / platform documentation and state in comments what each
provider assumes (for example whether the heading is relative to magnetic or true north).

### 3. Pointing direction from device rotation
Do **not** interpret alpha/beta/gamma directly as azimuth/elevation. When a phone is held
upright toward the sky, Euler angles behave badly. Instead:
- convert the device rotation to a rotation matrix or quaternion,
- take the direction the **rear camera** looks along (the device's negative Z axis),
- express it in the local East-North-Up frame, then derive azimuth/elevation from it,
- account for screen orientation (portrait vs landscape).

Put this math in pure functions with unit tests (known orientations in, expected
azimuth/elevation out; derive expected values by hand and note how in test comments).

### 4. Magnetic declination correction
Phone compasses report relative to magnetic north, while the aircraft azimuth in
`geo/` is relative to true north. Add a small module that, given the observer's
latitude/longitude (and date), returns the magnetic declination, and apply it so the
provider output is relative to true north.
Check what approach fits (a World Magnetic Model library vs a simple lookup). **Ask before
adding any dependency**, and explain the trade-off briefly.

### 5. Record and replay (debug mode)
Add a hidden debug mode (e.g. enabled with a query parameter) that:
- records the raw sensor stream plus observer position to a JSON file the user can download,
- can replay such a file through a `ReplayProvider` implementing the same interface.
The purpose: capture real-world phone data once, then reuse it in tests and development.

### 6. Minimal UI to verify it
A very small debug screen is enough: a "Start sensors" button (to satisfy the user-gesture
requirement), live readout of azimuth / elevation, the active provider, permission/status,
and the record/replay controls. Do not build the camera overlay.

## Out of scope for now
Camera feed and AR overlay, dead-reckoning extrapolation of aircraft positions, manual
calibration offset, PWA/service worker setup, deployment, any backend changes.

## Working style
- Small, reviewable commits, one logical step each: interface + fake provider, pose math +
  tests, platform providers, declination, record/replay, debug screen.
- Ask before adding dependencies.
- Keep code readable; this is a portfolio project and I need to explain every part of it
  in interviews.
- Note anything you could not verify without a real device, so I can test it manually.
- Stop at the end and summarize what is done, what needs on-device testing, and what the
  natural next step is.