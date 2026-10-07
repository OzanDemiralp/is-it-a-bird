import * as geomagnetism from 'geomagnetism'
import type { ObserverPosition } from './types'

/**
 * Magnetic declination in degrees at the observer's position: the angle from true north to
 * magnetic north, positive when magnetic north lies EAST of true north.
 *   true heading = magnetic heading + declination
 *
 * Uses NOAA's World Magnetic Model via the `geomagnetism` package (runs offline, ~0.5 degree
 * accuracy). The model is only valid for its 5-year epoch; outside it we fall back to the nearest
 * model rather than throwing.
 */
export function magneticDeclinationDeg(observer: ObserverPosition, date: Date = new Date()): number {
  const model = geomagnetism.model(date, { allowOutOfBoundsModel: true })
  return model.point([observer.lat, observer.lon]).decl
}

/** Convert a heading measured from magnetic north to one measured from true north, in [0, 360). */
export function magneticToTrue(magneticHeadingDeg: number, declinationDeg: number): number {
  return (((magneticHeadingDeg + declinationDeg) % 360) + 360) % 360
}
