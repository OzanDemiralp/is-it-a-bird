import { useState } from 'react'
import './App.css'
import { ApiError } from './api/errors'
import { AircraftTable } from './components/AircraftTable'
import { ObserverForm, type ObserverInput } from './components/ObserverForm'
import { fetchSky, type SkyAircraft } from './services/skyService'

// Starting values for the verification form (Zurich Airport); editable in the UI.
const INITIAL_OBSERVER: ObserverInput = { lat: 47.4647, lon: 8.5492, alt: 430, radiusKm: 50 }

function App() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<SkyAircraft[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit({ lat, lon, alt, radiusKm }: ObserverInput) {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchSky({ lat, lon, alt }, radiusKm))
    } catch (e) {
      setRows(null)
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app">
      <h1>Is it a bird?</h1>
      <p>Aircraft currently above your horizon (verification view).</p>
      <ObserverForm initial={INITIAL_OBSERVER} loading={loading} onSubmit={handleSubmit} />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {rows && <AircraftTable rows={rows} />}
    </main>
  )
}

export default App
