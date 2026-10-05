import { fetchAircraft } from '../api/aircraftApi'
import type { Aircraft } from '../api/types'
import { azimuthElevation, type Geodetic } from '../geo'

/** An aircraft together with where it appears in the observer's sky. */
export interface SkyAircraft {
  aircraft: Aircraft
  azimuth: number
  elevation: number
  range: number
}

/**
 * Pure: places each airborne aircraft in the observer's sky.
 * Aircraft on the ground, without altitude, or below the horizon are dropped.
 * Result is sorted nearest first.
 */
export function computeSkyPositions(observer: Geodetic, aircraft: Aircraft[]): SkyAircraft[] {
  const visible: SkyAircraft[] = []
  for (const a of aircraft) {
    if (a.on_ground || a.altitude === null) continue
    const { azimuth, elevation, range } = azimuthElevation(observer, {
      lat: a.lat,
      lon: a.lon,
      alt: a.altitude,
    })
    if (elevation <= 0) continue
    visible.push({ aircraft: a, azimuth, elevation, range })
  }
  return visible.sort((x, y) => x.range - y.range)
}

/** Fetches nearby aircraft and returns the ones currently above the observer's horizon. */
export async function fetchSky(
  observer: Geodetic,
  radiusKm: number,
  signal?: AbortSignal,
): Promise<SkyAircraft[]> {
  const response = await fetchAircraft(observer.lat, observer.lon, radiusKm, signal)
  return computeSkyPositions(observer, response.aircraft)
}
