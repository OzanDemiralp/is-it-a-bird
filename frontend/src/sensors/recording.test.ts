import { describe, expect, it } from 'vitest'
import { isSensorRecording, parseRecording, SensorRecorder } from './recording'
import type { RawOrientationSample } from './types'

describe('recording', () => {
  const baseSample: RawOrientationSample = {
    timestamp: 1000,
    alpha: 10,
    beta: 20,
    gamma: 30,
    absolute: true,
    screenAngleDeg: 0,
  }

  it('validates v1 recording without label (backward compatibility)', () => {
    const legacy = {
      version: 1,
      provider: 'ios',
      startedAt: '2026-01-01T10:00:00Z',
      observer: { lat: 47.4, lon: 8.5 },
      samples: [baseSample],
    }

    expect(isSensorRecording(legacy)).toBe(true)
    const parsed = parseRecording(JSON.stringify(legacy))
    expect(parsed.label).toBeUndefined()
    expect(parsed.provider).toBe('ios')
  })

  it('validates v1 recording with label', () => {
    const withLabel = {
      version: 1,
      provider: 'android-absolute',
      startedAt: '2026-01-01T10:00:00Z',
      observer: { lat: 47.4, lon: 8.5 },
      label: 'Zurich TV Tower',
      samples: [baseSample],
    }

    expect(isSensorRecording(withLabel)).toBe(true)
    const parsed = parseRecording(JSON.stringify(withLabel))
    expect(parsed.label).toBe('Zurich TV Tower')
  })

  it('rejects invalid recordings', () => {
    expect(isSensorRecording(null)).toBe(false)
    expect(isSensorRecording({})).toBe(false)
    expect(isSensorRecording({ version: 2 })).toBe(false)
    expect(
      isSensorRecording({
        version: 1,
        provider: 'ios',
        startedAt: '2026-01-01T10:00:00Z',
        observer: null,
        label: 123, // invalid label type
        samples: [],
      })
    ).toBe(false)
  })

  it('records samples with and without label', () => {
    const recorder = new SensorRecorder('ios')
    expect(recorder.isRecording).toBe(false)

    // With label
    recorder.start({ lat: 47.4, lon: 8.5 }, 'Church Steeple')
    expect(recorder.isRecording).toBe(true)
    expect(recorder.currentLabel).toBe('Church Steeple')
    recorder.push(baseSample)
    expect(recorder.count).toBe(1)

    const result = recorder.stop()
    expect(recorder.isRecording).toBe(false)
    expect(result.label).toBe('Church Steeple')
    expect(result.samples).toHaveLength(1)

    // Without label
    recorder.start(null)
    recorder.push(baseSample)
    const resultNoLabel = recorder.stop()
    expect(resultNoLabel.label).toBeUndefined()
  })
})
