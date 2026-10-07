import { BaseProvider } from './baseProvider'
import { magneticDeclinationDeg } from './declination'
import { rawToPointing } from './rawToPointing'
import type { ObserverPosition, RawOrientationSample } from './types'

/**
 * Base for providers that read real (or recorded) raw sensor data. Subclasses only produce
 * `RawOrientationSample`s via `handleRaw`; conversion to true-north pointing happens here, so
 * live and replayed data go through identical code.
 */
export abstract class RawProvider extends BaseProvider {
  private readonly rawListeners = new Set<(raw: RawOrientationSample) => void>()
  private declinationCache: { key: string; value: number } | null = null

  protected readonly getObserver: () => ObserverPosition | null

  /** `getObserver` is read on every sample so a moving observer is picked up automatically. */
  constructor(getObserver: () => ObserverPosition | null) {
    super()
    this.getObserver = getObserver
  }

  /** Raw stream tap, used by the recorder. */
  subscribeRaw(callback: (raw: RawOrientationSample) => void): () => void {
    this.rawListeners.add(callback)
    return () => this.rawListeners.delete(callback)
  }

  protected handleRaw(raw: RawOrientationSample): void {
    this.rawListeners.forEach((cb) => cb(raw))
    const pointing = rawToPointing(raw, this.declination(raw.timestamp))
    if (pointing) {
      if (this.getStatus().state !== 'running') this.setStatus({ state: 'running' })
      this.emit(pointing)
    }
  }

  /** Declination changes by far less than 0.1 degree over a few km, so cache per 0.1 degree cell. */
  private declination(timestamp: number): number {
    const observer = this.getObserver()
    if (!observer) return 0
    const key = `${observer.lat.toFixed(1)},${observer.lon.toFixed(1)}`
    if (this.declinationCache?.key !== key) {
      this.declinationCache = { key, value: magneticDeclinationDeg(observer, new Date(timestamp)) }
    }
    return this.declinationCache.value
  }
}
