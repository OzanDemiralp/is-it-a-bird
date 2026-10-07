import { RawProvider } from './rawProvider'
import type { SensorRecording } from './recording'

/**
 * Replays a recorded raw sensor stream through the same conversion code as the live providers,
 * using the observer position stored in the recording (for declination).
 * Original timing is kept (scaled by `speed`); `loop` restarts after the last sample.
 */
export class ReplayProvider extends RawProvider {
  readonly name = 'replay'

  private timer: ReturnType<typeof setTimeout> | null = null
  private index = 0

  private readonly recording: SensorRecording
  private readonly options: { speed?: number; loop?: boolean }

  constructor(recording: SensorRecording, options: { speed?: number; loop?: boolean } = {}) {
    super(() => recording.observer)
    this.recording = recording
    this.options = options
  }

  async start(): Promise<void> {
    if (this.recording.samples.length === 0) {
      this.setStatus({ state: 'unavailable', message: 'Recording contains no samples.' })
      return
    }
    this.index = 0
    this.setStatus({ state: 'starting', message: `Replaying ${this.recording.samples.length} samples` })
    this.step()
  }

  stop(): void {
    this.clearTimer()
    this.setStatus({ state: 'stopped' })
  }

  private step(): void {
    const { samples } = this.recording
    const current = samples[this.index]
    this.handleRaw(current)

    const next = samples[this.index + 1]
    if (next) {
      this.index += 1
      const delay = Math.max(0, (next.timestamp - current.timestamp) / (this.options.speed ?? 1))
      this.timer = setTimeout(() => this.step(), delay)
    } else if (this.options.loop) {
      this.index = 0
      this.timer = setTimeout(() => this.step(), 100)
    } else {
      this.timer = null
      this.setStatus({ state: 'stopped', message: 'Replay finished.' })
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
  }
}
