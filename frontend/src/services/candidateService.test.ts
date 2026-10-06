import { describe, expect, it } from 'vitest'
import type { Aircraft } from '../api/types'
import { rankCandidates } from './candidateService'
import type { SkyAircraft } from './skyService'

/** Builds a SkyAircraft directly from its sky position; the underlying Aircraft is irrelevant here. */
function sky(id: string, azimuth: number, elevation: number, range = 10000): SkyAircraft {
  const aircraft = { icao24: id } as Aircraft
  return { aircraft, azimuth, elevation, range }
}

const ids = (result: ReturnType<typeof rankCandidates>) =>
  result.candidates.map((c) => c.aircraft.aircraft.icao24)

// Pointing due east, 30 deg above the horizon. Aircraft below are placed on the same elevation, so
// their separation equals their azimuth difference scaled by cos(30) (derived per test).
// To keep derivations trivial, most tests vary only elevation: same azimuth => separation = dEl.
const pointing = { azimuth: 90, elevation: 30 }

describe('rankCandidates', () => {
  it('returns nothing, and no clear match, when no aircraft is inside the cone', () => {
    // Elevation difference of 40 deg => separation 40 > default cone of 20.
    const result = rankCandidates(pointing, [sky('far', 90, 70)])
    expect(result.candidates).toEqual([])
    expect(result.isClearMatch).toBe(false)
  })

  it('returns nothing for an empty sky', () => {
    expect(rankCandidates(pointing, [])).toEqual({ candidates: [], isClearMatch: false })
  })

  it('selects a lone aircraft in the cone as a clear match', () => {
    // Same azimuth, 10 deg higher => separation exactly 10.
    const result = rankCandidates(pointing, [sky('near', 90, 40), sky('far', 90, 70)])
    expect(ids(result)).toEqual(['near'])
    expect(result.candidates[0].separation).toBeCloseTo(10, 6)
    expect(result.isClearMatch).toBe(true)
  })

  it('is not a clear match when several aircraft are in the cone', () => {
    const result = rankCandidates(pointing, [sky('a', 90, 35), sky('b', 90, 45)])
    expect(result.isClearMatch).toBe(false)
  })

  it('orders by angular separation, closest first', () => {
    // Separations: a = 12, b = 3, c = 7 (same azimuth, elevation differences).
    const result = rankCandidates(pointing, [sky('a', 90, 42), sky('b', 90, 33), sky('c', 90, 23)])
    expect(ids(result)).toEqual(['b', 'c', 'a'])
  })

  it('returns at most 3 candidates by default, keeping the best', () => {
    // Separations 2, 4, 6, 8, 10.
    const result = rankCandidates(pointing, [
      sky('s10', 90, 40),
      sky('s2', 90, 32),
      sky('s8', 90, 38),
      sky('s4', 90, 34),
      sky('s6', 90, 36),
    ])
    expect(ids(result)).toEqual(['s2', 's4', 's6'])
  })

  it('includes an aircraft just inside the cone edge, excludes one just beyond', () => {
    // Separations 19.9 and 20.1 around the default cone of 20 (avoids exact-edge float noise).
    const result = rankCandidates(pointing, [sky('in', 90, 49.9), sky('out', 90, 50.1)])
    expect(ids(result)).toEqual(['in'])
  })

  it('breaks near-ties by range: separations 5.2 and 5.4 share a 1 deg step, nearer wins', () => {
    // round(5.2) = round(5.4) = 5, so range decides.
    const result = rankCandidates(pointing, [
      sky('farther', 90, 35.2, 20000),
      sky('nearer', 90, 35.4, 8000),
    ])
    expect(ids(result)).toEqual(['nearer', 'farther'])
  })

  it('does not break clear differences by range: 5.2 beats 6.1 even if farther', () => {
    // round(5.2) = 5, round(6.1) = 6: different steps, so separation decides.
    const result = rankCandidates(pointing, [
      sky('a-closer-angle-but-farther', 90, 35.2, 30000),
      sky('b-nearer-but-wider-angle', 90, 36.1, 1000),
    ])
    expect(ids(result)).toEqual(['a-closer-angle-but-farther', 'b-nearer-but-wider-angle'])
  })

  it('handles azimuth wrap-around: pointing 359, aircraft at 2 is 3 deg away at the horizon', () => {
    const result = rankCandidates({ azimuth: 359, elevation: 0 }, [sky('wrap', 2, 0)])
    expect(result.candidates[0].separation).toBeCloseTo(3, 6)
    expect(result.isClearMatch).toBe(true)
  })

  it('handles looking nearly straight up: opposite azimuths at elevation 80 are 20 apart', () => {
    // Both are 10 deg from the zenith on opposite sides: 10 + 10 = 20. Azimuths differ by 180 deg,
    // yet the aircraft is a candidate. The cone is widened to 25 to stay clear of the exact edge.
    const result = rankCandidates({ azimuth: 0, elevation: 80 }, [sky('over', 180, 80)], {
      coneDegrees: 25,
    })
    expect(result.candidates[0].separation).toBeCloseTo(20, 6)
  })

  it('respects custom options', () => {
    const aircraft = [sky('a', 90, 33), sky('b', 90, 36), sky('c', 90, 45)]
    expect(ids(rankCandidates(pointing, aircraft, { maxCandidates: 1 }))).toEqual(['a'])
    expect(ids(rankCandidates(pointing, aircraft, { coneDegrees: 5 }))).toEqual(['a'])
    expect(ids(rankCandidates(pointing, aircraft, { coneDegrees: 5 }))).not.toContain('c')
  })

  it('does not modify the input array', () => {
    const aircraft = [sky('b', 90, 40), sky('a', 90, 32)]
    const copy = [...aircraft]
    rankCandidates(pointing, aircraft)
    expect(aircraft).toEqual(copy)
  })
})
