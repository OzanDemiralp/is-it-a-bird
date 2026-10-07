import { describe, expect, it } from 'vitest'
import { alphaForHeading, deviceHeadingDeg, pointingFromEuler } from './pose'

// Expected values are derived by hand from the third column of R = Rz(a) Rx(b) Ry(g), which is the
// device z axis in ENU (the camera looks along its negative):
//   zx = sin g cos a + cos g sin b sin a
//   zy = sin g sin a - cos g sin b cos a
//   zz = cos g cos b
// camera = -(zx, zy, zz), azimuth = atan2(east, north), elevation = asin(up).

function expectPointing(
  [alpha, beta, gamma]: [number, number, number],
  azimuth: number,
  elevation: number,
) {
  const p = pointingFromEuler(alpha, beta, gamma)
  expect(p.azimuthDeg).toBeCloseTo(azimuth, 6)
  expect(p.elevationDeg).toBeCloseTo(elevation, 6)
}

describe('pointingFromEuler', () => {
  it('flat, screen up: camera looks straight down', () => {
    // a=b=g=0 -> z column (0,0,1) -> camera (0,0,-1) -> elevation -90
    expect(pointingFromEuler(0, 0, 0).elevationDeg).toBeCloseTo(-90, 6)
  })

  it('upright, top up, facing north: horizon in the north', () => {
    // b=90 -> z column (0,-1,0) -> camera (0,1,0): north, elevation 0
    expectPointing([0, 90, 0], 0, 0)
  })

  it('alpha is counter-clockwise: alpha 90 turns the camera from north to west', () => {
    // a=90, b=90 -> z column (1,0,0) -> camera (-1,0,0): west
    expectPointing([90, 90, 0], 270, 0)
  })

  it('tilted back 45 degrees from upright looks 45 degrees up', () => {
    // b=135 -> z column (0, -sin135, cos135) = (0,-.707,-.707) -> camera (0,.707,.707)
    expectPointing([0, 135, 0], 0, 45)
  })

  it('same tilt with alpha 270 faces east', () => {
    // alpha 270 ccw = 90 cw; x = zx = sin b sin a = -.707 -> camera east component +.707
    expectPointing([270, 135, 0], 90, 45)
  })

  it('beta 180 points at the zenith and stays well-behaved there', () => {
    // b=180 -> z column (0,0,-1) -> camera (0,0,1)
    expect(pointingFromEuler(0, 180, 0).elevationDeg).toBeCloseTo(90, 6)
    expect(pointingFromEuler(123, 180, 0).elevationDeg).toBeCloseTo(90, 6)
  })

  it('landscape-style roll: beta 0, gamma 90 puts the camera on the western horizon', () => {
    // g=90, b=0 -> z column (1,0,0) -> camera (-1,0,0)
    expectPointing([0, 0, 90], 270, 0)
  })

  it('upright and rolled 45 degrees about the vertical: camera azimuth NW', () => {
    // b=90, g=45, a=0 -> z column (sin45, -cos45, 0) -> camera (-.707, .707, 0)
    expectPointing([0, 90, 45], 315, 0)
  })

  it('azimuth always falls in [0, 360)', () => {
    for (let a = 0; a < 360; a += 15) {
      const { azimuthDeg } = pointingFromEuler(a, 90, 0)
      expect(azimuthDeg).toBeGreaterThanOrEqual(0)
      expect(azimuthDeg).toBeLessThan(360)
    }
  })
})

describe('deviceHeadingDeg / alphaForHeading (iOS alpha fix)', () => {
  it('upright uses the camera direction', () => {
    expect(deviceHeadingDeg(0, 90, 0)).toBeCloseTo(0, 6)
    expect(deviceHeadingDeg(90, 90, 0)).toBeCloseTo(270, 6)
  })

  it('flat uses the top edge: alpha 270 puts it to the east', () => {
    // y column = (-sin a cos b, cos a cos b, sin b) = (1, 0, 0) for a=270, b=0
    expect(deviceHeadingDeg(270, 0, 0)).toBeCloseTo(90, 6)
  })

  it('flat and upside down (camera at the zenith) falls back to the top edge, which points south', () => {
    // b=180 -> y column (-sin a cos b, cos a cos b, sin b) = (0, -1, 0)
    expect(deviceHeadingDeg(0, 180, 0)).toBeCloseTo(180, 6)
  })

  it('alphaForHeading makes the heading come out as requested', () => {
    // upright, want to face east (90): alpha 270 (see test above)
    expect(alphaForHeading(90, 0, 90)).toBeCloseTo(270, 6)
    for (const [beta, gamma] of [[90, 0], [120, 10], [10, 5]]) {
      const alpha = alphaForHeading(beta, gamma, 200)!
      expect(deviceHeadingDeg(alpha, beta, gamma)).toBeCloseTo(200, 6)
    }
  })
})
