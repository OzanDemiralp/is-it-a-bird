// Public contract of the sensor layer. Everything outside `sensors/` should only depend on this
// file (and `createOrientationProvider`), never on a concrete platform provider.

/** Where the rear camera points, relative to TRUE north and the horizon. */
export interface PointingSample {
  /** Degrees clockwise from true north, in [0, 360). */
  azimuthDeg: number
  /** Degrees above the horizon, in [-90, 90]. */
  elevationDeg: number
  /** Milliseconds since the epoch (event time on the device). */
  timestamp: number
  /** Estimated heading error in degrees, if the platform reports one (iOS does, Android doesn't). */
  accuracyHint?: number
}

export type SensorState =
  | 'idle' // created, not started
  | 'starting' // waiting for permission / first event
  | 'running'
  | 'stopped'
  | 'unavailable' // no usable sensor on this device/browser
  | 'permission-denied'

export interface SensorStatus {
  state: SensorState
  /** Human-readable explanation, shown in the debug screen. */
  message?: string
}

export interface OrientationProvider {
  /** Short identifier of the implementation ("ios", "android-absolute", "fake", "replay"). */
  readonly name: string
  /**
   * Start emitting samples. On iOS this triggers the permission prompt, so it MUST be called
   * directly from a user gesture handler (e.g. a click). Never rejects; failures show up in the
   * status (see `getStatus` / `subscribeStatus`).
   */
  start(): Promise<void>
  stop(): void
  /** Returns an unsubscribe function. */
  subscribe(callback: (sample: PointingSample) => void): () => void
  getStatus(): SensorStatus
  subscribeStatus(callback: (status: SensorStatus) => void): () => void
}

/** Observer position, needed to turn magnetic headings into true-north headings. */
export interface ObserverPosition {
  lat: number
  lon: number
}

/**
 * One raw reading of the platform's orientation sensors, before any math. This is what gets
 * recorded and replayed, so it must contain everything needed to reproduce the pointing result.
 */
export interface RawOrientationSample {
  timestamp: number
  /** W3C DeviceOrientation angles in degrees (null when the sensor reports nothing). */
  alpha: number | null
  beta: number | null
  gamma: number | null
  /**
   * true  = alpha is already referenced to (magnetic) north (Android "absolute" orientation);
   * false = alpha has an arbitrary zero, use `compassHeadingDeg` to fix it (iOS).
   */
  absolute: boolean
  /** iOS only: `webkitCompassHeading`, degrees clockwise from MAGNETIC north. */
  compassHeadingDeg?: number
  /** iOS only: `webkitCompassAccuracy`, in degrees (negative values mean invalid; stored as given). */
  compassAccuracyDeg?: number
  /** Screen rotation at the time of the reading. Recorded for diagnostics; see pose.ts. */
  screenAngleDeg: number
}
