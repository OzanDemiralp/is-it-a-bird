import { describe, expect, it } from 'vitest'
import type { Aircraft } from '../api/types'
import { computeSkyPositions } from './skyService'

const observer = { lat: 0, lon: 0, alt: 0 }

function plane(overrides: Partial<Aircraft>): Aircraft {
  return {
    icao24: 'aaaaaa',
    callsign: null,
    lat: 0,
    lon: 0,
    altitude: 1000,
    velocity: null,
    heading: null,
    vertical_rate: null,
    on_ground: false,
    last_contact: 0,
    ...overrides,
  }
}

describe('computeSkyPositions', () => {
  it('places an aircraft directly overhead at elevation 90', () => {
    // Same lat/lon, +1000 m: pure "up" (see geodesy.test.ts).
    const [result] = computeSkyPositions(observer, [plane({})])
    expect(result.elevation).toBeCloseTo(90, 6)
    expect(result.range).toBeCloseTo(1000, 6)
  })

  it('drops aircraft on the ground, without altitude, or below the horizon', () => {
    const result = computeSkyPositions(observer, [
      plane({ icao24: 'ground', on_ground: true }),
      plane({ icao24: 'noalt', altitude: null }),
      // 1 degree east (~111 km) at 100 m altitude: the horizon drops ~970 m by then (d^2/2R),
      // so it is below the horizon.
      plane({ icao24: 'far', lon: 1, altitude: 100 }),
      plane({ icao24: 'ok' }),
    ])
    expect(result.map((r) => r.aircraft.icao24)).toEqual(['ok'])
  })

  it('sorts nearest first', () => {
    const result = computeSkyPositions(observer, [
      plane({ icao24: 'high', altitude: 5000 }),
      plane({ icao24: 'low', altitude: 500 }),
    ])
    expect(result.map((r) => r.aircraft.icao24)).toEqual(['low', 'high'])
  })

  it('returns an empty list for no aircraft', () => {
    expect(computeSkyPositions(observer, [])).toEqual([])
  })
})
