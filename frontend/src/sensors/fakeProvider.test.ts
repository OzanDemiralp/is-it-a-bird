import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeProvider } from './fakeProvider'
import type { PointingSample } from './types'

afterEach(() => vi.useRealTimers())

describe('FakeProvider', () => {
  it('emits nothing before start and normalises values after', async () => {
    const p = new FakeProvider()
    const got: PointingSample[] = []
    p.subscribe((s) => got.push(s))

    p.setPointing(10, 10)
    expect(got).toHaveLength(0)

    await p.start()
    p.setPointing(-90, 120)
    expect(got[0].azimuthDeg).toBe(270)
    expect(got[0].elevationDeg).toBe(90)
  })

  it('unsubscribe stops delivery and status changes are reported', async () => {
    const p = new FakeProvider()
    const states: string[] = []
    p.subscribeStatus((s) => states.push(s.state))
    const got: PointingSample[] = []
    const off = p.subscribe((s) => got.push(s))

    await p.start()
    p.setPointing(1, 1)
    off()
    p.setPointing(2, 2)
    p.stop()

    expect(got).toHaveLength(1)
    expect(states).toEqual(['running', 'stopped'])
  })

  it('plays a script at the given interval', async () => {
    vi.useFakeTimers()
    const p = new FakeProvider()
    const got: number[] = []
    p.subscribe((s) => got.push(s.azimuthDeg))
    await p.start()

    p.playScript(
      [
        { azimuthDeg: 0, elevationDeg: 0 },
        { azimuthDeg: 45, elevationDeg: 10 },
      ],
      50,
    )
    vi.advanceTimersByTime(500)
    expect(got).toEqual([0, 45])
  })
})
