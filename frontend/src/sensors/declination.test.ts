import { describe, expect, it, vi } from 'vitest'
import { magneticDeclinationDeg, magneticToTrue } from './declination'

describe('magneticDeclinationDeg', () => {
  // Reference values: NOAA declination calculator, roughly 2025/26. Wide ranges because the field
  // drifts a little every year; the point is the sign and magnitude.
  const date = new Date('2026-01-01T00:00:00Z')

  it('is small and east of north in Zurich', () => {
    const d = magneticDeclinationDeg({ lat: 47.4647, lon: 8.5492 }, date)
    expect(d).toBeGreaterThan(1)
    expect(d).toBeLessThan(5)
  })

  it('is strongly east in Seattle and west in Boston', () => {
    expect(magneticDeclinationDeg({ lat: 47.6, lon: -122.3 }, date)).toBeGreaterThan(12)
    expect(magneticDeclinationDeg({ lat: 42.36, lon: -71.06 }, date)).toBeLessThan(-12)
  })

  it('does not throw for dates outside the model epoch', () => {
    // The library logs a notice for out-of-range dates; keep test output clean.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => magneticDeclinationDeg({ lat: 0, lon: 0 }, new Date('2060-01-01'))).not.toThrow()
    vi.restoreAllMocks()
  })
})

describe('magneticToTrue', () => {
  it('adds declination and wraps', () => {
    expect(magneticToTrue(100, 3)).toBe(103)
    expect(magneticToTrue(358, 5)).toBe(3)
    expect(magneticToTrue(2, -5)).toBe(357)
  })
})
