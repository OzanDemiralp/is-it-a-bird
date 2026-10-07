import { alphaForHeading, pointingFromEuler } from './pose'
import { magneticToTrue } from './declination'
import type { PointingSample, RawOrientationSample } from './types'

/**
 * Raw sensor reading -> camera pointing relative to TRUE north. This is the single place where
 * platform differences are resolved, and it is shared by live providers and the replay provider.
 *
 * Both platforms deliver MAGNETIC north references:
 *  - Android absolute orientation (rotation vector sensor) -> alpha is relative to magnetic north.
 *  - iOS webkitCompassHeading -> degrees from magnetic north (true north is only available via
 *    CoreLocation, which the web does not expose).
 * So `declinationDeg` is added to the azimuth in both cases. Elevation comes from gravity only and
 * needs no correction.
 *
 * Returns null while the reading is unusable (missing angles, invalid compass, degenerate pose).
 */
export function rawToPointing(raw: RawOrientationSample, declinationDeg: number): PointingSample | null {
  const { alpha, beta, gamma } = raw
  if (beta === null || gamma === null) return null

  let alphaNorth: number
  let accuracyHint: number | undefined

  if (raw.absolute) {
    if (alpha === null) return null
    alphaNorth = alpha
  } else {
    // iOS: alpha has an arbitrary zero, so rebuild it from the compass heading.
    if (raw.compassHeadingDeg === undefined || !Number.isFinite(raw.compassHeadingDeg)) return null
    const fixed = alphaForHeading(beta, gamma, raw.compassHeadingDeg)
    if (fixed === null) return null
    alphaNorth = fixed
    // iOS reports a negative accuracy when the compass is not calibrated / invalid.
    if (raw.compassAccuracyDeg !== undefined && raw.compassAccuracyDeg >= 0) {
      accuracyHint = raw.compassAccuracyDeg
    }
    if (raw.compassAccuracyDeg !== undefined && raw.compassAccuracyDeg < 0) return null
  }

  const { azimuthDeg, elevationDeg } = pointingFromEuler(alphaNorth, beta, gamma)
  return {
    azimuthDeg: magneticToTrue(azimuthDeg, declinationDeg),
    elevationDeg,
    timestamp: raw.timestamp,
    accuracyHint,
  }
}
