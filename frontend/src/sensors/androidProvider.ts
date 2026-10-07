import { RawProvider } from './rawProvider'
import type { ObserverPosition, RawOrientationSample } from './types'

export function currentScreenAngle(): number {
  return screen.orientation?.angle ?? 0
}

/**
 * Android / any browser exposing ABSOLUTE orientation (Chrome: `deviceorientationabsolute`).
 *
 * Assumptions (from MDN "Window: deviceorientationabsolute event" and the W3C DeviceOrientation spec):
 *  - alpha/beta/gamma describe the device frame relative to the Earth frame (X east, Y north, Z up),
 *    with alpha measured around Z, counter-clockwise, from NORTH.
 *  - "North" here is MAGNETIC north (Android rotation-vector sensor), so declination is applied
 *    downstream in `rawToPointing`.
 *  - No permission prompt is needed on Android Chrome; the page must be served over HTTPS.
 *  - Browsers without `deviceorientationabsolute` may still send plain `deviceorientation` events
 *    with `absolute === true`; we accept those and ignore relative ones.
 *  - No accuracy value is exposed, so `accuracyHint` stays undefined.
 */
export class AndroidAbsoluteProvider extends RawProvider {
  readonly name = 'android-absolute'

  private eventName: string | null = null

  constructor(getObserver: () => ObserverPosition | null) {
    super(getObserver)
  }

  private readonly onEvent = (event: Event): void => {
    const e = event as DeviceOrientationEvent
    // Plain `deviceorientation` events are relative on most browsers: skip them.
    if (this.eventName === 'deviceorientation' && !e.absolute) return
    const raw: RawOrientationSample = {
      timestamp: Date.now(),
      alpha: e.alpha,
      beta: e.beta,
      gamma: e.gamma,
      absolute: true,
      screenAngleDeg: currentScreenAngle(),
    }
    this.handleRaw(raw)
  }

  async start(): Promise<void> {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      this.setStatus({ state: 'unavailable', message: 'DeviceOrientationEvent is not supported.' })
      return
    }
    this.eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(this.eventName, this.onEvent)
    this.setStatus({ state: 'starting', message: 'Waiting for the first sensor reading...' })
  }

  stop(): void {
    if (this.eventName) window.removeEventListener(this.eventName, this.onEvent)
    this.eventName = null
    this.setStatus({ state: 'stopped' })
  }
}
