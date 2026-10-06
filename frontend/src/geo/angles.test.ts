import { describe, expect, it } from 'vitest'
import { angularSeparation } from './angles'

const dir = (azimuth: number, elevation: number) => ({ azimuth, elevation })

describe('angularSeparation', () => {
  it('is 0 for the same direction', () => {
    expect(angularSeparation(dir(123, 45), dir(123, 45))).toBeCloseTo(0, 6)
  })

  it('is 90 between north and east on the horizon', () => {
    // Two horizontal directions a quarter turn apart.
    expect(angularSeparation(dir(0, 0), dir(90, 0))).toBeCloseTo(90, 6)
  })

  it('is 90 between the horizon and the zenith, whatever the azimuth', () => {
    expect(angularSeparation(dir(0, 0), dir(0, 90))).toBeCloseTo(90, 6)
    expect(angularSeparation(dir(200, 0), dir(0, 90))).toBeCloseTo(90, 6)
  })

  it('wraps around north: 350 and 10 are 20 apart, not 340', () => {
    expect(angularSeparation(dir(350, 0), dir(10, 0))).toBeCloseTo(20, 6)
  })

  it('is 0 at the zenith: azimuth is meaningless straight up', () => {
    expect(angularSeparation(dir(0, 90), dir(180, 90))).toBeCloseTo(0, 6)
  })

  it('goes over the zenith: opposite sides at elevation 60 are 60 apart, not 180', () => {
    // Each direction is 30 deg from the zenith, on opposite sides: 30 + 30 = 60.
    expect(angularSeparation(dir(0, 60), dir(180, 60))).toBeCloseTo(60, 6)
  })

  it('azimuth differences shrink with elevation: 90 apart at elevation 60 is ~41.41', () => {
    // Spherical law of cosines: cos(sep) = sin60*sin60 + cos60*cos60*cos90 = 0.75,
    // so sep = acos(0.75) = 41.4096 deg.
    expect(angularSeparation(dir(0, 60), dir(90, 60))).toBeCloseTo(41.4096, 3)
  })

  it('is symmetric', () => {
    const a = dir(20, 15)
    const b = dir(300, 70)
    expect(angularSeparation(a, b)).toBeCloseTo(angularSeparation(b, a), 9)
  })
})
