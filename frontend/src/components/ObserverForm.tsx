import { useState, type SubmitEventHandler } from 'react'

export interface ObserverInput {
  lat: number
  lon: number
  alt: number
  radiusKm: number
}

interface Props {
  initial: ObserverInput
  loading: boolean
  onSubmit: (value: ObserverInput) => void
}

export function ObserverForm({ initial, loading, onSubmit }: Props) {
  const [lat, setLat] = useState(String(initial.lat))
  const [lon, setLon] = useState(String(initial.lon))
  const [alt, setAlt] = useState(String(initial.alt))
  const [radiusKm, setRadiusKm] = useState(String(initial.radiusKm))

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    onSubmit({ lat: Number(lat), lon: Number(lon), alt: Number(alt), radiusKm: Number(radiusKm) })
  }

  return (
    <form className="observer-form" onSubmit={handleSubmit}>
      <label>
        Latitude
        <input id="lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
      </label>
      <label>
        Longitude
        <input id="lon" type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} />
      </label>
      <label>
        Your altitude (m)
        <input id="alt" type="number" step="any" value={alt} onChange={(e) => setAlt(e.target.value)} />
      </label>
      <label>
        Radius (km)
        <input
          id="radius"
          type="number"
          step="any"
          value={radiusKm}
          onChange={(e) => setRadiusKm(e.target.value)}
        />
      </label>
      <button id="search" type="submit" disabled={loading}>
        {loading ? 'Loading…' : 'Look up'}
      </button>
    </form>
  )
}
