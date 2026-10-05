import { describe, expect, it } from 'vitest'
import { azimuthElevation, geodeticToEcef, WGS84_A } from './geodesy'

describe('geodeticToEcef', () => {
  it('maps (0, 0, 0) to (a, 0, 0)', () => {
    // On the equator at the prime meridian, the point lies on the x axis at the semi-major axis.
    const p = geodeticToEcef({ lat: 0, lon: 0, alt: 0 })
    expect(p.x).toBeCloseTo(WGS84_A, 6)
    expect(p.y).toBeCloseTo(0, 6)
    expect(p.z).toBeCloseTo(0, 6)
  })

  it('maps the north pole to z = b = a * (1 - f)', () => {
    // b = 6356752.314245 m (published WGS84 semi-minor axis).
    const p = geodeticToEcef({ lat: 90, lon: 0, alt: 0 })
    expect(p.z).toBeCloseTo(6356752.314245, 3)
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(0, 3)
  })
})

describe('azimuthElevation', () => {
  const observer = { lat: 0, lon: 0, alt: 0 }

  it('target directly overhead: elevation 90, range = altitude difference', () => {
    // Same lat/lon, +1000 m: the displacement is purely along the local "up" axis.
    const r = azimuthElevation(observer, { lat: 0, lon: 0, alt: 1000 })
    expect(r.elevation).toBeCloseTo(90, 6)
    expect(r.range).toBeCloseTo(1000, 6)
  })

  it('target directly below: elevation -90', () => {
    // Observer at 10 km, target on the ground at the same lat/lon: purely along "down".
    const r = azimuthElevation({ lat: 0, lon: 0, alt: 10000 }, { lat: 0, lon: 0, alt: 0 })
    expect(r.elevation).toBeCloseTo(-90, 6)
    expect(r.range).toBeCloseTo(10000, 6)
  })

  it('target due east on the equator: azimuth 90, elevation -0.5, exact chord range', () => {
    // The equator is a circle of radius a. Two points 1 degree apart are joined by a chord of
    // length 2a*sin(0.5 deg). The chord makes an angle of half the arc (0.5 deg) with the
    // tangent line (the local horizon), pointing below it.
    const r = azimuthElevation(observer, { lat: 0, lon: 1, alt: 0 })
    expect(r.azimuth).toBeCloseTo(90, 6)
    expect(r.elevation).toBeCloseTo(-0.5, 6)
    expect(r.range).toBeCloseTo(2 * WGS84_A * Math.sin((0.5 * Math.PI) / 180), 4)
  })

  it('target due west and due south by symmetry: azimuth 270 and 180', () => {
    expect(azimuthElevation(observer, { lat: 0, lon: -1, alt: 0 }).azimuth).toBeCloseTo(270, 6)
    expect(azimuthElevation(observer, { lat: -1, lon: 0, alt: 0 }).azimuth).toBeCloseTo(180, 6)
  })

  it('target due north at the same altitude: azimuth 0, slightly below the horizon', () => {
    // 1 degree of latitude at the equator is about 110574 m of meridian arc (published value).
    // Same reasoning as the east case: elevation ~ -(arc / 2R) with R ~ 6335439 m (meridional
    // radius of curvature at the equator) = -0.5 degrees. Chord ~ arc (differs by ~1 m).
    const r = azimuthElevation(observer, { lat: 1, lon: 0, alt: 0 })
    expect(r.azimuth).toBeCloseTo(0, 6)
    expect(r.elevation).toBeCloseTo(-0.5, 1)
    expect(Math.abs(r.range - 110574)).toBeLessThan(50)
  })

  it('normalizes azimuth into [0, 360)', () => {
    // A target slightly west of north would be atan2 = -small; it must come back as ~360-small.
    const r = azimuthElevation(observer, { lat: 1, lon: -0.001, alt: 0 })
    expect(r.azimuth).toBeGreaterThan(359)
    expect(r.azimuth).toBeLessThan(360)
  })

  it('realistic case: airliner at 10 km altitude, ~9.95 km north', () => {
    // 0.09 deg of latitude at the equator = 0.09 * 110574 = 9951.7 m of ground distance d.
    // Earth curvature drops the target below the observer's horizon plane by ~ d^2 / (2R)
    // = 9951.7^2 / (2 * 6335439) = 7.8 m, so the effective "up" is 10000 - 7.8 = 9992.2 m.
    // elevation = atan(9992.2 / 9951.7) = atan(1.00407) = 45 deg + 0.407/2 rad = ~45.117 deg.
    const r = azimuthElevation(observer, { lat: 0.09, lon: 0, alt: 10000 })
    expect(r.azimuth).toBeCloseTo(0, 6)
    expect(Math.abs(r.elevation - 45.117)).toBeLessThan(0.05)
    expect(Math.abs(r.range - Math.hypot(9951.7, 9992.2))).toBeLessThan(20)
  })
})
