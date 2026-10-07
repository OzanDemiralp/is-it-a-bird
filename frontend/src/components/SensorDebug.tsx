import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  SensorRecorder,
  createOrientationProvider,
  parseRecording,
  type ObserverPosition,
  type PointingSample,
  type ProviderChoice,
  type SensorStatus,
} from '../sensors'
import { CameraPreview } from './CameraPreview'

type Active = Extract<ProviderChoice, { ok: true }>

/** Minimal verification screen for the sensor layer (shown with `?debug=sensors`). */
export function SensorDebug() {
  const [lat, setLat] = useState('47.4647')
  const [lon, setLon] = useState('8.5492')
  const [active, setActive] = useState<Active | null>(null)
  const [status, setStatus] = useState<SensorStatus>({ state: 'idle' })
  const [failure, setFailure] = useState<string | null>(null)
  const [sample, setSample] = useState<PointingSample | null>(null)
  const [recorder, setRecorder] = useState<SensorRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingLabel, setRecordingLabel] = useState('')

  const observerRef = useRef<ObserverPosition | null>(null)
  const teardownRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const parsedLat = Number(lat)
    const parsedLon = Number(lon)
    observerRef.current = lat !== '' && lon !== '' && Number.isFinite(parsedLat) && Number.isFinite(parsedLon)
      ? { lat: parsedLat, lon: parsedLon }
      : null
  }, [lat, lon])

  useEffect(() => () => teardownRef.current?.(), [])

  /** Stops whatever is running and starts `choice`. Called straight from click handlers. */
  function activate(choice: ProviderChoice) {
    teardownRef.current?.()
    teardownRef.current = null
    setSample(null)
    setRecording(false)
    setRecorder(null)

    if (choice.ok === false) {
      setActive(null)
      setFailure(choice.reason)
      setStatus({ state: 'unavailable', message: choice.reason })
      return
    }

    const { provider, raw } = choice
    const newRecorder = raw ? new SensorRecorder(provider.name) : null
    const unsubs = [
      provider.subscribe(setSample),
      provider.subscribeStatus(setStatus),
      ...(raw && newRecorder ? [raw.subscribeRaw((r) => newRecorder.push(r))] : []),
    ]
    teardownRef.current = () => {
      unsubs.forEach((off) => off())
      provider.stop()
    }
    setFailure(null)
    setActive(choice)
    setRecorder(newRecorder)
    void provider.start()
  }

  function handleStart() {
    // `start()` runs inside this click handler, which iOS requires for the permission prompt.
    activate(createOrientationProvider({ getObserver: () => observerRef.current }))
  }

  function handleFake() {
    activate(createOrientationProvider({ getObserver: () => observerRef.current, force: 'fake' }))
  }

  function handleStop() {
    teardownRef.current?.()
    teardownRef.current = null
    setRecording(false)
  }

  function toggleRecording() {
    if (!recorder) return
    if (recorder.isRecording) {
      const data = recorder.stop()
      setRecording(false)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const safeLabel = data.label
        ? `-${data.label.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '')}`
        : ''
      link.download = `sensor-recording${safeLabel}-${data.startedAt.replace(/[:.]/g, '-')}.json`
      link.click()
      URL.revokeObjectURL(link.href)
    } else {
      recorder.start(observerRef.current, recordingLabel)
      setRecording(true)
    }
  }

  async function handleReplayFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const data = parseRecording(await file.text())
      if (data.label) {
        setRecordingLabel(data.label)
      }
      activate(createOrientationProvider({ getObserver: () => null, force: 'replay', recording: data }))
    } catch (e) {
      activate({ ok: false, reason: e instanceof Error ? e.message : 'Could not read recording.' })
    }
  }

  return (
    <main className="app">
      <h1>Sensor debug</h1>

      {/* Camera preview with optical axis crosshair and high-contrast outdoor readout */}
      <CameraPreview sample={sample} />

      <form className="observer-form" onSubmit={(e) => e.preventDefault()}>
        <label>
          Latitude (for declination)
          <input id="sensor-lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
        </label>
        <label>
          Longitude
          <input id="sensor-lon" type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} />
        </label>
      </form>

      <p>
        <button id="sensor-start" type="button" onClick={handleStart}>
          Start sensors
        </button>{' '}
        <button id="sensor-fake" type="button" onClick={handleFake}>
          Use fake provider
        </button>{' '}
        <button id="sensor-stop" type="button" onClick={handleStop} disabled={!active}>
          Stop
        </button>
      </p>

      <dl>
        <dt>Provider</dt>
        <dd id="sensor-provider">{active?.kind ?? '—'}</dd>
        <dt>Status</dt>
        <dd id="sensor-status">
          {status.state}
          {status.message ? ` – ${status.message}` : ''}
        </dd>
        <dt>Azimuth (true north)</dt>
        <dd id="sensor-azimuth">{sample ? `${sample.azimuthDeg.toFixed(1)}°` : '—'}</dd>
        <dt>Elevation</dt>
        <dd id="sensor-elevation">{sample ? `${sample.elevationDeg.toFixed(1)}°` : '—'}</dd>
        <dt>Accuracy hint</dt>
        <dd id="sensor-accuracy">{sample?.accuracyHint !== undefined ? `±${sample.accuracyHint}°` : '—'}</dd>
      </dl>

      {failure && (
        <p role="alert" className="error">
          {failure}
        </p>
      )}

      {active?.kind === 'fake' && <FakeControls provider={active.provider} />}

      <h2>Record / replay</h2>
      <div className="record-form">
        <label htmlFor="sensor-recording-label">
          Landmark label (optional)
          <input
            id="sensor-recording-label"
            type="text"
            value={recordingLabel}
            onChange={(e) => setRecordingLabel(e.target.value)}
            placeholder="e.g. Uetliberg tower"
            disabled={recording}
          />
        </label>
        <p>
          <button id="sensor-record" type="button" onClick={toggleRecording} disabled={!recorder}>
            {recording ? `Stop & download (${recorder?.count ?? 0} samples)` : 'Start recording'}
          </button>
        </p>
      </div>
      <label>
        Replay a recording{' '}
        <input id="sensor-replay-file" type="file" accept="application/json" onChange={handleReplayFile} />
      </label>
    </main>
  )
}

function FakeControls({ provider }: { provider: Active['provider'] }) {
  const [az, setAz] = useState(0)
  const [el, setEl] = useState(0)

  function update(nextAz: number, nextEl: number) {
    setAz(nextAz)
    setEl(nextEl)
    ;(provider as { setPointing?: (a: number, e: number) => void }).setPointing?.(nextAz, nextEl)
  }

  return (
    <div>
      <label>
        Azimuth {az}°
        <input type="range" min={0} max={359} value={az} onChange={(e) => update(Number(e.target.value), el)} />
      </label>
      <label>
        Elevation {el}°
        <input type="range" min={-90} max={90} value={el} onChange={(e) => update(az, Number(e.target.value))} />
      </label>
    </div>
  )
}
