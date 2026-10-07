import { currentScreenAngle } from './androidProvider'
import { RawProvider } from './rawProvider'
import type { ObserverPosition, RawOrientationSample } from './types'

/** iOS Safari's non-standard additions to DeviceOrientationEvent. */
interface IosDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

type PermissionResult = 'granted' | 'denied' | 'default'
interface IosDeviceOrientationStatic {
  requestPermission?: () => Promise<PermissionResult>
}

/**
 * iOS Safari (13+).
 *
 * Assumptions (from MDN "DeviceOrientationEvent.requestPermission" and Apple's Safari docs):
 *  - Access is gated behind `DeviceOrientationEvent.requestPermission()`, which only works when
 *    called from a user gesture and requires HTTPS. It resolves 'granted' or 'denied'; once denied
 *    the user must reset it in Safari settings / by reloading the page.
 *  - iOS `deviceorientation` events are RELATIVE: alpha has an arbitrary zero (where the phone was
 *    when the page started), `absolute` is false. beta/gamma are fine.
 *  - Absolute heading comes from the non-standard `webkitCompassHeading` (degrees clockwise from
 *    MAGNETIC north) and `webkitCompassAccuracy` (degrees; negative = invalid). We use it to
 *    replace alpha (see `alphaForHeading`), then apply declination.
 *  - UNVERIFIED without a device: that webkitCompassHeading follows the rear camera when the
 *    phone is upright (and the top edge when flat). `deviceHeadingDeg` encodes that assumption.
 */
export class IosProvider extends RawProvider {
  readonly name = 'ios'

  private listening = false

  constructor(getObserver: () => ObserverPosition | null) {
    super(getObserver)
  }

  private readonly onEvent = (event: Event): void => {
    const e = event as IosDeviceOrientationEvent
    const raw: RawOrientationSample = {
      timestamp: Date.now(),
      alpha: e.alpha,
      beta: e.beta,
      gamma: e.gamma,
      absolute: false,
      compassHeadingDeg: e.webkitCompassHeading,
      compassAccuracyDeg: e.webkitCompassAccuracy,
      screenAngleDeg: currentScreenAngle(),
    }
    this.handleRaw(raw)
  }

  async start(): Promise<void> {
    const ctor = (window as { DeviceOrientationEvent?: IosDeviceOrientationStatic }).DeviceOrientationEvent
    if (!ctor) {
      this.setStatus({ state: 'unavailable', message: 'DeviceOrientationEvent is not supported.' })
      return
    }

    this.setStatus({ state: 'starting', message: 'Requesting motion & orientation permission...' })
    // Must be the first thing that happens in the click handler: awaiting anything before this call
    // could make Safari consider the user gesture expired.
    if (typeof ctor.requestPermission === 'function') {
      let result: PermissionResult
      try {
        result = await ctor.requestPermission()
      } catch (err) {
        this.setStatus({
          state: 'permission-denied',
          message: `Permission request failed (needs HTTPS and a user gesture): ${String(err)}`,
        })
        return
      }
      if (result !== 'granted') {
        this.setStatus({ state: 'permission-denied', message: 'Motion & orientation access was denied.' })
        return
      }
    }

    window.addEventListener('deviceorientation', this.onEvent)
    this.listening = true
    this.setStatus({ state: 'starting', message: 'Waiting for the first sensor reading...' })
  }

  stop(): void {
    if (this.listening) window.removeEventListener('deviceorientation', this.onEvent)
    this.listening = false
    this.setStatus({ state: 'stopped' })
  }
}
