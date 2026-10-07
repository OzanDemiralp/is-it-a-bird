import { BaseProvider } from './baseProvider'

/**
 * Emits values we control: either one at a time via `setPointing` (desktop development, sliders)
 * or a scripted sequence via `playScript` (tests). Values are already "true north", no maths.
 */
export class FakeProvider extends BaseProvider {
  readonly name = 'fake'

  private timer: ReturnType<typeof setInterval> | null = null

  async start(): Promise<void> {
    this.setStatus({ state: 'running', message: 'Fake provider: values are set manually.' })
  }

  stop(): void {
    this.clearTimer()
    this.setStatus({ state: 'stopped' })
  }

  /** Emit one sample now. Only has an effect while running. */
  setPointing(azimuthDeg: number, elevationDeg: number, accuracyHint?: number): void {
    if (this.getStatus().state !== 'running') return
    this.emit({
      azimuthDeg: ((azimuthDeg % 360) + 360) % 360,
      elevationDeg: Math.max(-90, Math.min(90, elevationDeg)),
      timestamp: Date.now(),
      accuracyHint,
    })
  }

  /** Emit `steps` one per `intervalMs`, then stop the timer. */
  playScript(steps: { azimuthDeg: number; elevationDeg: number }[], intervalMs = 100): void {
    this.clearTimer()
    let i = 0
    this.timer = setInterval(() => {
      if (i >= steps.length) return this.clearTimer()
      const { azimuthDeg, elevationDeg } = steps[i++]
      this.setPointing(azimuthDeg, elevationDeg)
    }, intervalMs)
  }

  private clearTimer(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }
}
