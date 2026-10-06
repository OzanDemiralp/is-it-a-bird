// Angle helpers for directions in the sky. Pure functions, no dependencies.

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

/** A direction in the sky, in degrees: azimuth clockwise from north, elevation above the horizon. */
export interface SkyDirection {
  azimuth: number
  elevation: number
}

/**
 * Angle in degrees (0-180) between two sky directions, measured along the sky as seen from the
 * observer. Uses the haversine form on the sphere of directions:
 *
 *   a   = sin^2(dEl / 2) + cos(el1) * cos(el2) * sin^2(dAz / 2)
 *   sep = 2 * asin(sqrt(a))
 *
 * Azimuth wrap-around (350 deg vs 10 deg) is handled because only sin^2(dAz / 2) is used, and
 * azimuth differences count for less near the zenith because of the cos(el) factors.
 */
export function angularSeparation(a: SkyDirection, b: SkyDirection): number {
  const el1 = a.elevation * DEG2RAD
  const el2 = b.elevation * DEG2RAD
  const sinHalfDEl = Math.sin((el2 - el1) / 2)
  const sinHalfDAz = Math.sin(((b.azimuth - a.azimuth) * DEG2RAD) / 2)

  const h = sinHalfDEl * sinHalfDEl + Math.cos(el1) * Math.cos(el2) * sinHalfDAz * sinHalfDAz
  // Clamp: floating point can push h marginally above 1.
  return 2 * Math.asin(Math.min(1, Math.sqrt(h))) * RAD2DEG
}
