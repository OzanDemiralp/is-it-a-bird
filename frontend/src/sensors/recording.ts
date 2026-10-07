import type { ObserverPosition, RawOrientationSample } from './types'

/** A captured sensor session: the raw stream plus where the observer was standing. */
export interface SensorRecording {
  version: 1
  /** Provider that captured it ("ios" | "android-absolute"). */
  provider: string
  startedAt: string
  observer: ObserverPosition | null
  samples: RawOrientationSample[]
}

export function isSensorRecording(value: unknown): value is SensorRecording {
  const v = value as Partial<SensorRecording> | null
  return (
    typeof v === 'object' &&
    v !== null &&
    v.version === 1 &&
    Array.isArray(v.samples) &&
    v.samples.every((s) => typeof s?.timestamp === 'number')
  )
}

export function parseRecording(json: string): SensorRecording {
  const parsed: unknown = JSON.parse(json)
  if (!isSensorRecording(parsed)) throw new Error('Not a valid sensor recording file.')
  return parsed
}

/** Collects raw samples while `recording` is true. Feed it with `push`. */
export class SensorRecorder {
  private samples: RawOrientationSample[] = []
  private observer: ObserverPosition | null = null
  private startedAt = ''
  private active = false

  private readonly providerName: string

  constructor(providerName: string) {
    this.providerName = providerName
  }

  get isRecording(): boolean {
    return this.active
  }

  get count(): number {
    return this.samples.length
  }

  start(observer: ObserverPosition | null): void {
    this.samples = []
    this.observer = observer
    this.startedAt = new Date().toISOString()
    this.active = true
  }

  stop(): SensorRecording {
    this.active = false
    return {
      version: 1,
      provider: this.providerName,
      startedAt: this.startedAt,
      observer: this.observer,
      samples: this.samples,
    }
  }

  push(raw: RawOrientationSample): void {
    if (this.active) this.samples.push(raw)
  }
}
