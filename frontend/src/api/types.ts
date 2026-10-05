/** Mirrors the backend `Aircraft` / `AircraftResponse` schemas (backend/app/schemas/aircraft.py). */
export interface Aircraft {
  icao24: string
  callsign: string | null
  lat: number
  lon: number
  /** Meters; geometric if available, else barometric. */
  altitude: number | null
  /** Ground speed, m/s. */
  velocity: number | null
  /** True track, degrees clockwise from north. */
  heading: number | null
  /** m/s, positive = climbing. */
  vertical_rate: number | null
  on_ground: boolean
  /** Unix timestamp (seconds). */
  last_contact: number
}

export interface AircraftResponse {
  time: number
  count: number
  aircraft: Aircraft[]
}
