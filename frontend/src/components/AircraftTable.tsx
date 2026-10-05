import type { SkyAircraft } from '../services/skyService'

interface Props {
  rows: SkyAircraft[]
}

const FEET_PER_METER = 3.28084

export function AircraftTable({ rows }: Props) {
  if (rows.length === 0) return <p>No aircraft above the horizon.</p>

  return (
    <table className="aircraft-table">
      <thead>
        <tr>
          <th>Callsign</th>
          <th>ICAO24</th>
          <th>Azimuth (°)</th>
          <th>Elevation (°)</th>
          <th>Range (km)</th>
          <th>Altitude (m / ft)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ aircraft, azimuth, elevation, range }) => (
          <tr key={aircraft.icao24}>
            <td>{aircraft.callsign ?? '—'}</td>
            <td>{aircraft.icao24}</td>
            <td>{azimuth.toFixed(1)}</td>
            <td>{elevation.toFixed(1)}</td>
            <td>{(range / 1000).toFixed(1)}</td>
            <td>
              {aircraft.altitude === null
                ? '—'
                : `${Math.round(aircraft.altitude)} / ${Math.round(aircraft.altitude * FEET_PER_METER)}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
