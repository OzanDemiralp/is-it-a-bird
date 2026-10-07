import { useEffect, useRef, useState } from 'react'
import type { PointingSample } from '../sensors'

interface CameraPreviewProps {
  sample: PointingSample | null
}

/**
 * Camera preview with optical-axis crosshair and high-contrast outdoor readout.
 * Designed for outdoor landmark aiming on mobile devices (iOS Safari and Android Chrome).
 */
export function CameraPreview({ sample }: CameraPreviewProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch {
          // ignore error during track shutdown
        }
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }

  // Stop all camera tracks on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Sync stream to video element whenever streaming becomes active
  useEffect(() => {
    const video = videoRef.current
    if (isStreaming && video && streamRef.current) {
      video.srcObject = streamRef.current
      video.muted = true
      video.play().catch((playErr) => {
        console.warn('video.play() rejected:', playErr)
      })
    }
  }, [isStreaming])

  async function startCamera() {
    setError(null)

    // Check 1: Insecure context
    // Camera access requires HTTPS (or localhost). Browsers block or omit getUserMedia on HTTP.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError(
        'Camera access requires HTTPS or localhost (insecure context). Camera access needs HTTPS (or localhost) and a user gesture.'
      )
      return
    }

    // Check 2: Browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        'Camera API (getUserMedia) is not supported in this browser. Camera access needs HTTPS (or localhost) and a user gesture.'
      )
      return
    }

    setIsLoading(true)

    try {
      // Request rear camera using facingMode: { ideal: 'environment' }.
      // 'ideal' is preferred over 'exact' to prevent failure on laptops/desktops or single-lens devices.
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
      } catch (firstErr) {
        // Fallback for browsers or hardware that throw OverconstrainedError on facingMode
        if (
          firstErr instanceof DOMException &&
          (firstErr.name === 'OverconstrainedError' || firstErr.name === 'ConstraintNotSatisfiedError')
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        } else {
          throw firstErr
        }
      }

      streamRef.current = stream

      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        // In iOS Safari, explicitly setting muted on the DOM node is required before play()
        video.muted = true
        try {
          await video.play()
        } catch (playErr) {
          console.warn('Initial video.play() failed:', playErr)
        }
      }

      setIsStreaming(true)
    } catch (err: unknown) {
      stopCamera()
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError(
            'Camera permission denied. Camera access needs HTTPS (or localhost) and a user gesture; please enable camera permissions in your browser settings.'
          )
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera device found on this system.')
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is currently in use by another application or could not be accessed.')
        } else if (err.name === 'OverconstrainedError') {
          setError('The requested camera settings could not be satisfied.')
        } else if (err.name === 'SecurityError') {
          setError(
            'Camera access blocked by security policy. Camera access needs HTTPS (or localhost) and a user gesture.'
          )
        } else {
          setError(`Camera error (${err.name}): ${err.message}`)
        }
      } else if (err instanceof Error) {
        setError(`Camera error: ${err.message}`)
      } else {
        setError('Failed to start camera. Camera access needs HTTPS (or localhost) and a user gesture.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="camera-section" aria-label="Camera preview">
      <div className="camera-controls">
        <button
          id="camera-toggle"
          type="button"
          onClick={isStreaming ? stopCamera : startCamera}
          disabled={isLoading}
        >
          {isLoading ? 'Starting camera…' : isStreaming ? 'Stop camera' : 'Start camera'}
        </button>
        {isStreaming && <span className="camera-status-pill">● REAR CAMERA ACTIVE</span>}
      </div>

      {error && (
        <p role="alert" className="error camera-error" id="camera-error">
          {error}
        </p>
      )}

      <div className={`camera-viewport ${isStreaming ? 'active' : 'idle'}`} id="camera-preview">
        {/*
          The crosshair stands for the rear camera's optical axis.
          The preview may be cropped (e.g. object-fit: cover) but the center stays the center.
        */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
          onLoadedMetadata={() => {
            // iOS Safari quirk: play() when metadata is ready
            videoRef.current?.play().catch(() => {})
          }}
        />

        {!isStreaming && (
          <div className="camera-placeholder">
            <p>Camera is stopped.</p>
            <p className="camera-hint">
              Tap <strong>Start camera</strong> above to aim at landmarks using the optical crosshair.
            </p>
          </div>
        )}

        {isStreaming && (
          <>
            {/*
              Crosshair overlay: centered on the preview.
              Uses dual stroke (black outline + white core) to remain high-contrast on both bright sky and dark buildings.
            */}
            <div className="camera-crosshair" aria-hidden="true" id="camera-crosshair">
              <svg viewBox="-80 -80 160 160" className="crosshair-svg" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="crosshair-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#000000" floodOpacity="1" />
                  </filter>
                </defs>
                {/* Dark outer outline for visibility against bright sky, white clouds, and glare */}
                <g stroke="#000000" strokeWidth="3.5" strokeLinecap="round" fill="none">
                  <circle cx="0" cy="0" r="16" />
                  <line x1="-70" y1="0" x2="-22" y2="0" />
                  <line x1="22" y1="0" x2="70" y2="0" />
                  <line x1="0" y1="-70" x2="0" y2="-22" />
                  <line x1="0" y1="22" x2="0" y2="70" />
                  <circle cx="0" cy="0" r="1.5" fill="#000000" />
                </g>
                {/* Bright white core for visibility against dark buildings, hills, and night */}
                <g stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" filter="url(#crosshair-shadow)">
                  <circle cx="0" cy="0" r="16" />
                  <line x1="-70" y1="0" x2="-22" y2="0" />
                  <line x1="22" y1="0" x2="70" y2="0" />
                  <line x1="0" y1="-70" x2="0" y2="-22" />
                  <line x1="0" y1="22" x2="0" y2="70" />
                  <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
                </g>
              </svg>
            </div>

            {/* Live readout overlay directly on the viewfinder for outdoor aiming */}
            <div className="camera-overlay-readout" id="camera-overlay-readout">
              <div className="camera-overlay-chip">
                <span className="camera-overlay-lbl">AZ</span>
                <span className="camera-overlay-val">
                  {sample ? `${sample.azimuthDeg.toFixed(1)}°` : '—'}
                </span>
              </div>
              <div className="camera-overlay-chip">
                <span className="camera-overlay-lbl">EL</span>
                <span className="camera-overlay-val">
                  {sample ? `${sample.elevationDeg >= 0 ? '+' : ''}${sample.elevationDeg.toFixed(1)}°` : '—'}
                </span>
              </div>
              {sample?.accuracyHint !== undefined && (
                <div className="camera-overlay-chip camera-overlay-acc">
                  <span className="camera-overlay-lbl">ACC</span>
                  <span className="camera-overlay-val">±{sample.accuracyHint}°</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* High-contrast outdoor readout banner directly under the preview */}
      <div className="outdoor-readout" id="outdoor-readout">
        <div className="outdoor-readout-stat">
          <div className="outdoor-readout-lbl">AZIMUTH (TRUE NORTH)</div>
          <div className="outdoor-readout-num" id="outdoor-azimuth">
            {sample ? `${sample.azimuthDeg.toFixed(1)}°` : '—'}
          </div>
        </div>
        <div className="outdoor-readout-stat">
          <div className="outdoor-readout-lbl">ELEVATION</div>
          <div className="outdoor-readout-num" id="outdoor-elevation">
            {sample ? `${sample.elevationDeg >= 0 ? '+' : ''}${sample.elevationDeg.toFixed(1)}°` : '—'}
          </div>
        </div>
        <div className="outdoor-readout-stat">
          <div className="outdoor-readout-lbl">ACCURACY</div>
          <div className="outdoor-readout-num" id="outdoor-accuracy">
            {sample?.accuracyHint !== undefined ? `±${sample.accuracyHint}°` : '—'}
          </div>
        </div>
      </div>
    </section>
  )
}
