import { ApiError, apiErrorFromResponse } from './errors'
import type { AircraftResponse } from './types'

/** GET /api/aircraft (proxied to the backend in dev). Throws ApiError on any failure. */
export async function fetchAircraft(
  lat: number,
  lon: number,
  radiusKm: number,
  signal?: AbortSignal,
): Promise<AircraftResponse> {
  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius_km: String(radiusKm),
  })

  let response: Response
  try {
    response = await fetch(`/api/aircraft?${query}`, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK_ERROR', 'NetworkError', 'Could not reach the server')
  }

  if (!response.ok) throw await apiErrorFromResponse(response)
  return (await response.json()) as AircraftResponse
}
