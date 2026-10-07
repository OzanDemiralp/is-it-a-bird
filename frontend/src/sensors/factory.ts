import { AndroidAbsoluteProvider } from './androidProvider'
import { FakeProvider } from './fakeProvider'
import { IosProvider } from './iosProvider'
import { ReplayProvider } from './replayProvider'
import type { SensorRecording } from './recording'
import type { ObserverPosition, OrientationProvider } from './types'
import type { RawProvider } from './rawProvider'

export type ProviderKind = 'ios' | 'android-absolute' | 'fake' | 'replay'

export type ProviderChoice =
  | { ok: true; kind: ProviderKind; provider: OrientationProvider; raw: RawProvider | null }
  | { ok: false; reason: string }

export interface ProviderOptions {
  getObserver: () => ObserverPosition | null
  /** Skip detection and use this provider (desktop development, tests, replay). */
  force?: 'fake' | 'replay'
  recording?: SensorRecording
}

/**
 * Picks the provider for this runtime:
 *  - iOS Safari is detected by the presence of `DeviceOrientationEvent.requestPermission`
 *    (more reliable than user-agent sniffing, and true for iPadOS posing as a Mac).
 *  - other browsers with `DeviceOrientationEvent` get the absolute provider.
 *  - otherwise `ok: false` with a reason for the UI. Permission denial is only known after
 *    `start()`, and is reported through the provider status.
 * `raw` is the same object as `provider` when it is a raw-sensor provider (recordable).
 */
export function createOrientationProvider(options: ProviderOptions): ProviderChoice {
  if (options.force === 'fake') {
    return { ok: true, kind: 'fake', provider: new FakeProvider(), raw: null }
  }
  if (options.force === 'replay') {
    if (!options.recording) return { ok: false, reason: 'No recording loaded for replay.' }
    const provider = new ReplayProvider(options.recording)
    return { ok: true, kind: 'replay', provider, raw: provider }
  }

  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
    return { ok: false, reason: 'This device/browser has no orientation sensors (try the fake provider).' }
  }
  if (!window.isSecureContext) {
    return { ok: false, reason: 'Sensors need HTTPS (or localhost).' }
  }

  const needsPermission =
    typeof (window.DeviceOrientationEvent as { requestPermission?: unknown }).requestPermission === 'function'
  if (needsPermission) {
    const provider = new IosProvider(options.getObserver)
    return { ok: true, kind: 'ios', provider, raw: provider }
  }
  const provider = new AndroidAbsoluteProvider(options.getObserver)
  return { ok: true, kind: 'android-absolute', provider, raw: provider }
}
