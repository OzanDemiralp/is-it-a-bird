import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAircraft } from './aircraftApi'
import { ApiError } from './errors'

function mockFetch(impl: () => Promise<Response>) {
  const fn = vi.fn<typeof fetch>(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchAircraft', () => {
  it('calls /api/aircraft with the query and returns the parsed body', async () => {
    const body = { time: 1, count: 0, aircraft: [] }
    const fn = mockFetch(async () => Response.json(body))

    await expect(fetchAircraft(47.5, 8.5, 20)).resolves.toEqual(body)
    expect(fn.mock.calls[0][0]).toBe('/api/aircraft?lat=47.5&lon=8.5&radius_km=20')
  })

  it('turns the backend error body into a typed ApiError', async () => {
    mockFetch(async () =>
      Response.json(
        { code: 'OPENSKY_RATE_LIMITED', name: 'OpenSkyRateLimitedError', message: 'slow down' },
        { status: 429 },
      ),
    )

    const error = await fetchAircraft(0, 0, 10).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 429,
      code: 'OPENSKY_RATE_LIMITED',
      errorName: 'OpenSkyRateLimitedError',
      message: 'slow down',
    })
  })

  it('keeps validation details', async () => {
    const details = [{ field: 'lat', issue: 'too big' }]
    mockFetch(async () =>
      Response.json(
        { code: 'REQUEST_VALIDATION_FAILED', name: 'RequestValidationFailedError', message: 'bad', details },
        { status: 422 },
      ),
    )
    const error = (await fetchAircraft(0, 0, 10).catch((e: unknown) => e)) as ApiError
    expect(error.details).toEqual(details)
  })

  it('maps a non-JSON error body to UNKNOWN_ERROR', async () => {
    mockFetch(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    const error = (await fetchAircraft(0, 0, 10).catch((e: unknown) => e)) as ApiError
    expect(error.code).toBe('UNKNOWN_ERROR')
    expect(error.status).toBe(502)
  })

  it('maps a failed connection to NETWORK_ERROR', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = (await fetchAircraft(0, 0, 10).catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('NETWORK_ERROR')
  })
})
