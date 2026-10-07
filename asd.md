# Task: Camera preview with crosshair on the sensor debug screen

## Context
The sensor layer (`frontend/src/sensors/`) and the debug screen (`SensorDebug.tsx`,
opened with `?debug=sensors`) already exist. I will use the debug screen outdoors to record
sensor sessions while aiming the phone at known landmarks. Right now the screen shows only
numbers, so I cannot aim precisely. I need a live camera preview with a centered crosshair
so I can put the landmark exactly at the center of the view while recording.

Inspect the repo first and follow its existing structure and style.

## Scope (debug screen only)
1. Add a rear-camera preview to the debug screen using `getUserMedia`
   (prefer `facingMode: environment`), shown full-width.
   - Start it from a user gesture (a button, e.g. "Start camera"), and stop all tracks on
     "Stop camera" and on unmount.
   - Make it work on iOS Safari and Android Chrome (check current docs; e.g. inline playback
     and muted attributes on the video element). Do not rely on memory for platform quirks.
   - Show clear status/errors for: no camera, permission denied, insecure context (not HTTPS).
2. Draw a crosshair overlay centered on the preview (simple CSS/SVG, thin lines,
   high-contrast so it is visible on sky and on buildings).
3. Overlay the live azimuth and elevation readout (from the existing `OrientationProvider`)
   on or directly under the preview, large enough to read outdoors.
4. Keep the existing record/replay controls usable together with the preview, so I can aim,
   press record, hold steady, and stop. Optionally add a text field for a short label
   (e.g. the landmark name) that is saved inside the recording JSON. If this requires
   changing the recording format, keep old recordings loadable.

## Out of scope
Aircraft overlays, `candidateService` integration, field-of-view mapping, any change to the
sensor math, backend changes, PWA setup.

## Notes
- The crosshair stands for the rear camera's optical axis. Mention in a code comment that
  the preview may be cropped (e.g. `object-fit: cover`) but the center stays the center.
- Camera access needs HTTPS (or localhost) and a user gesture; say so in the UI when it fails.
- Ask before adding any dependency.
- Keep changes small and reviewable. After finishing, list what must be verified on a real
  phone (iOS and Android) and anything you could not verify.