// Pure geometry helpers: WGS84 geodetic -> ECEF -> local ENU -> azimuth/elevation/range.
// No UI, no network, no side effects.

/** WGS84 semi-major axis (meters). */
export const WGS84_A = 6378137.0
/** WGS84 flattening. */
export const WGS84_F = 1 / 298.257223563
/** First eccentricity squared: e^2 = f * (2 - f). */
export const WGS84_E2 = WGS84_F * (2 - WGS84_F)

/** A position on Earth. Angles in degrees, altitude in meters above the WGS84 ellipsoid. */
export interface Geodetic {
  lat: number
  lon: number
  alt: number
}

/** Earth-Centered, Earth-Fixed Cartesian coordinates in meters. */
export interface Ecef {
  x: number
  y: number
  z: number
}

/** Local East-North-Up coordinates in meters, relative to an observer. */
export interface Enu {
  east: number
  north: number
  up: number
}

export interface AzimuthElevation {
  /** Degrees clockwise from true north, in [0, 360). */
  azimuth: number
  /** Degrees above the local horizon, in [-90, 90]. */
  elevation: number
  /** Straight-line distance (meters). */
  range: number
}

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

/** Geodetic (lat, lon, alt) -> ECEF, using the prime vertical radius of curvature N. */
export function geodeticToEcef({ lat, lon, alt }: Geodetic): Ecef {
  const phi = lat * DEG2RAD
  const lambda = lon * DEG2RAD
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)

  // N = a / sqrt(1 - e^2 sin^2(phi))
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi)

  return {
    x: (n + alt) * cosPhi * Math.cos(lambda),
    y: (n + alt) * cosPhi * Math.sin(lambda),
    z: (n * (1 - WGS84_E2) + alt) * sinPhi,
  }
}

/**
 * Rotates the ECEF difference (target - observer) into the observer's local
 * East-North-Up frame. The observer's lat/lon define the rotation.
 */
export function ecefToEnu(observer: Geodetic, targetEcef: Ecef): Enu {
  const obsEcef = geodeticToEcef(observer)
  const dx = targetEcef.x - obsEcef.x
  const dy = targetEcef.y - obsEcef.y
  const dz = targetEcef.z - obsEcef.z

  const phi = observer.lat * DEG2RAD
  const lambda = observer.lon * DEG2RAD
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const sinLambda = Math.sin(lambda)
  const cosLambda = Math.cos(lambda)

  return {
    east: -sinLambda * dx + cosLambda * dy,
    north: -sinPhi * cosLambda * dx - sinPhi * sinLambda * dy + cosPhi * dz,
    up: cosPhi * cosLambda * dx + cosPhi * sinLambda * dy + sinPhi * dz,
  }
}

/** Where `target` appears in the sky of `observer`. */
export function azimuthElevation(observer: Geodetic, target: Geodetic): AzimuthElevation {
  const { east, north, up } = ecefToEnu(observer, geodeticToEcef(target))

  const horizontal = Math.hypot(east, north)
  const range = Math.hypot(horizontal, up)

  // atan2(east, north) gives clockwise-from-north; shift negatives into [0, 360).
  let azimuth = Math.atan2(east, north) * RAD2DEG
  azimuth = ((azimuth % 360) + 360) % 360

  const elevation = Math.atan2(up, horizontal) * RAD2DEG

  return { azimuth, elevation, range }
}
