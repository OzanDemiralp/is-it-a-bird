import { afterEach, describe, expect, it, vi } from 'vitest'
import { rawToPointing } from './rawToPointing'
import { ReplayProvider } from './replayProvider'
import type { SensorRecording } from './recording'
import type { PointingSample, RawOrientationSample } from './types'

const base = { timestamp: 1_767_225_600_000, screenAngleDeg: 0 }

describe('rawToPointing', () => {
  it('Android: upright facing magnetic north, +5 declination -> true azimuth 5', () => {
    const raw: RawOrientationSample = { ...base, alpha: 0, beta: 90, gamma: 0, absolute: true }
    const p = rawToPointing(raw, 5)!
    expect(p.azimuthDeg).toBeCloseTo(5, 6)
    expect(p.elevationDeg).toBeCloseTo(0, 6)
    expect(p.accuracyHint).toBeUndefined()
  })

  it('iOS: arbitrary alpha is replaced by the compass heading', () => {
    const raw: RawOrientationSample = {
      ...base,
      alpha: 123, // arbitrary zero on iOS, must be ignored
      beta: 135,
      gamma: 0,
      absolute: false,
      compassHeadingDeg: 90,
      compassAccuracyDeg: 12,
    }
    // Facing magnetic east, tilted 45 degrees up; declination -3 -> true azimuth 87.
    const p = rawToPointing(raw, -3)!
    expect(p.azimuthDeg).toBeCloseTo(87, 6)
    expect(p.elevationDeg).toBeCloseTo(45, 6)
    expect(p.accuracyHint).toBe(12)
  })

  it('returns null for unusable readings', () => {
    const ios = { ...base, alpha: 0, beta: 90, gamma: 0, absolute: false }
    expect(rawToPointing({ ...ios, alpha: null, beta: null }, 0)).toBeNull()
    expect(rawToPointing(ios, 0)).toBeNull() // no compass heading
    expect(rawToPointing({ ...ios, compassHeadingDeg: 10, compassAccuracyDeg: -1 }, 0)).toBeNull()
    expect(rawToPointing({ ...base, alpha: null, beta: 90, gamma: 0, absolute: true }, 0)).toBeNull()
  })
})

describe('ReplayProvider', () => {
  afterEach(() => vi.useRealTimers())

  it('replays samples with the original timing through the normal pipeline', async () => {
    vi.useFakeTimers()
    const recording: SensorRecording = {
      version: 1,
      provider: 'android-absolute',
      startedAt: '2026-01-01T00:00:00Z',
      observer: { lat: 47.6, lon: -122.3 }, // Seattle: declination ~ +15
      samples: [
        { ...base, alpha: 0, beta: 90, gamma: 0, absolute: true },
        { ...base, timestamp: base.timestamp + 1000, alpha: 90, beta: 90, gamma: 0, absolute: true },
      ],
    }
    const provider = new ReplayProvider(recording)
    const got: PointingSample[] = []
    provider.subscribe((s) => got.push(s))

    await provider.start()
    expect(got).toHaveLength(1)
    expect(got[0].azimuthDeg).toBeGreaterThan(12) // 0 + declination
    vi.advanceTimersByTime(999)
    expect(got).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(got).toHaveLength(2)
    expect(got[1].azimuthDeg).toBeGreaterThan(270 + 12) // west + declination
    expect(provider.getStatus().state).toBe('stopped')
  })
})
