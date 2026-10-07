import type { OrientationProvider, PointingSample, SensorStatus } from './types'

/** Shared subscribe/status plumbing so concrete providers only deal with their own sensor. */
export abstract class BaseProvider implements OrientationProvider {
  abstract readonly name: string

  private status: SensorStatus = { state: 'idle' }
  private readonly sampleListeners = new Set<(sample: PointingSample) => void>()
  private readonly statusListeners = new Set<(status: SensorStatus) => void>()

  abstract start(): Promise<void>
  abstract stop(): void

  subscribe(callback: (sample: PointingSample) => void): () => void {
    this.sampleListeners.add(callback)
    return () => this.sampleListeners.delete(callback)
  }

  getStatus(): SensorStatus {
    return this.status
  }

  subscribeStatus(callback: (status: SensorStatus) => void): () => void {
    this.statusListeners.add(callback)
    return () => this.statusListeners.delete(callback)
  }

  protected setStatus(status: SensorStatus): void {
    this.status = status
    this.statusListeners.forEach((cb) => cb(status))
  }

  protected emit(sample: PointingSample): void {
    this.sampleListeners.forEach((cb) => cb(sample))
  }
}
