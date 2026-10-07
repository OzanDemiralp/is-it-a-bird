// Pure math: device rotation -> direction the rear camera points along.
// No browser APIs, so everything here is unit-testable.
//
// Frames (W3C DeviceOrientation spec):
//   Earth frame (ENU): X = East, Y = North, Z = Up.
//   Device frame:      x = right edge of the screen, y = top edge, z = out of the screen
//                      (towards the user). The rear camera therefore looks along -z.
//   The device frame is fixed to the phone's natural orientation and does NOT change when the
//   screen rotates between portrait and landscape.
//
// Why not read alpha/beta/gamma as azimuth/elevation: those are intrinsic Euler angles
// (Z-X'-Y'' order) and become degenerate / jump around when the phone is held upright
// (beta ~ 90), which is exactly how it is held when looking at the sky. We build the full
// rotation instead and only convert the resulting direction VECTOR to angles at the end.
//
// Screen orientation: because the camera axis (-z) is fixed to the device body, rotating the
// screen from portrait to landscape does not change where the camera points. It would only matter
// for a screen-aligned "up" vector (camera roll), which the AR overlay is out of scope for here.
// Hence no screen-angle parameter in this module.

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

export type Vec3 = readonly [number, number, number]

/**
 * Rotation matrix R = Rz(alpha) * Rx(beta) * Ry(gamma) mapping device coordinates to ENU,
 * returned as rows. This is the order defined by the W3C spec. Angles in degrees.
 */
export function rotationMatrix(alphaDeg: number, betaDeg: number, gammaDeg: number): number[][] {
  const a = alphaDeg * DEG2RAD
  const b = betaDeg * DEG2RAD
  const g = gammaDeg * DEG2RAD
  const cA = Math.cos(a)
  const sA = Math.sin(a)
  const cB = Math.cos(b)
  const sB = Math.sin(b)
  const cG = Math.cos(g)
  const sG = Math.sin(g)

  return [
    [cA * cG - sA * sB * sG, -cB * sA, cG * sA * sB + cA * sG],
    [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
    [-cB * sG, sB, cB * cG],
  ]
}

function multiply(m: number[][], v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ]
}

/** Unit vector (East, North, Up) the rear camera looks along: R * (0, 0, -1). */
export function cameraDirectionEnu(alphaDeg: number, betaDeg: number, gammaDeg: number): Vec3 {
  return multiply(rotationMatrix(alphaDeg, betaDeg, gammaDeg), [0, 0, -1])
}

/** Convert an ENU direction to azimuth (clockwise from north, [0, 360)) and elevation. */
export function enuToAzimuthElevation([east, north, up]: Vec3): {
  azimuthDeg: number
  elevationDeg: number
} {
  const azimuth = Math.atan2(east, north) * RAD2DEG
  const length = Math.hypot(east, north, up)
  // Clamp: rounding can push |up / length| marginally above 1.
  const elevation = Math.asin(Math.max(-1, Math.min(1, up / length))) * RAD2DEG
  return { azimuthDeg: (azimuth + 360) % 360, elevationDeg: elevation }
}

/** Camera pointing from W3C orientation angles whose alpha is already referenced to north. */
export function pointingFromEuler(alphaDeg: number, betaDeg: number, gammaDeg: number) {
  return enuToAzimuthElevation(cameraDirectionEnu(alphaDeg, betaDeg, gammaDeg))
}

/**
 * Compass heading (clockwise from the reference of alpha) the way phone compasses define it:
 * the direction of the top edge when the phone is flat, and of the rear camera when it is held
 * upright. Returns null when that direction has no horizontal component (degenerate).
 */
export function deviceHeadingDeg(alphaDeg: number, betaDeg: number, gammaDeg: number): number | null {
  const m = rotationMatrix(alphaDeg, betaDeg, gammaDeg)
  const flat = Math.abs(m[2][2]) > Math.SQRT1_2 // device z axis is mostly vertical
  const axis: Vec3 = flat ? [m[0][1], m[1][1], m[2][1]] : [-m[0][2], -m[1][2], -m[2][2]]
  if (Math.hypot(axis[0], axis[1]) < 1e-6) return null
  return (Math.atan2(axis[0], axis[1]) * RAD2DEG + 360) % 360
}

/**
 * For platforms where alpha has an arbitrary zero (iOS): find the alpha that makes the device
 * heading equal `headingDeg`. Rotating alpha by +x turns the device counter-clockwise, i.e. the
 * heading decreases by x, so alpha = heading(alpha = 0) - desired heading.
 */
export function alphaForHeading(betaDeg: number, gammaDeg: number, headingDeg: number): number | null {
  const h0 = deviceHeadingDeg(0, betaDeg, gammaDeg)
  if (h0 === null) return null
  return (((h0 - headingDeg) % 360) + 360) % 360
}
