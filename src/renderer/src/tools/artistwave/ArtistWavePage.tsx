import { useEffect, useState } from 'react'
import type { ArtistWaveAction, ArtistWaveStatus, ArtistWaveValue } from '@shared/types'
import { Icon } from '../../components/Icon'

const APP_URL = 'https://acsdd.github.io/ArtistWave/'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

interface ArtistWavePageProps {
  visible: boolean
  onHide: () => void
  onStop: () => void
}

/**
 * Full-window ArtistWave page. The iframe stays mounted while you browse other
 * pages, so audio keeps playing; only Stop detaches it and resets the session.
 */
export function ArtistWavePage({ visible, onHide, onStop }: ArtistWavePageProps) {
  const [status, setStatus] = useState<ArtistWaveStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [frameKey, setFrameKey] = useState(0)

  useEffect(() => {
    let alive = true

    window.api.artistwave
      .status()
      .then((next) => {
        if (alive) setStatus(next)
      })
      .catch((cause) => {
        if (alive) setError(errorMessage(cause))
      })

    const unsubscribe = window.api.artistwave.onUpdate((next) => {
      if (!alive) return
      setStatus(next)
      if (next.ready) setError(null)
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const send = (action: ArtistWaveAction, value?: ArtistWaveValue) => {
    setError(null)
    window.api.artistwave
      .command(action, value)
      .then(setStatus)
      .catch((cause) => setError(errorMessage(cause)))
  }

  const reload = () => {
    setError(null)
    setLoaded(false)
    setFrameKey((current) => current + 1)
    void window.api.artistwave.attach().catch((cause) => setError(errorMessage(cause)))
  }

  const snapshot = status?.snapshot ?? null
  const ready = Boolean(status?.ready && snapshot)
  const playing = snapshot?.playing === true
  const notice = error || status?.error || null

  return (
    <div className={`player-page ${visible ? '' : 'player-hidden'}`}>
      <div className="player-bar">
        <button
          type="button"
          className="ghost-button small player-back"
          onClick={onHide}
          title="Back to the dashboard — audio keeps playing"
        >
          <Icon name="back" size={15} />
          Dashboard
        </button>

        <div className="player-now">
          <span className={`player-dot ${playing ? 'playing' : ''}`} aria-hidden="true" />
          <div className="player-now-copy">
            <strong>{snapshot?.title ?? 'ArtistWave'}</strong>
            <span>{snapshot?.artist ?? 'Your station, embedded'}</span>
          </div>
        </div>

        <div className="player-transport" role="group" aria-label="Playback controls">
          <button
            type="button"
            className="player-icon"
            onClick={() => send('previous')}
            disabled={!ready}
            title="Previous track"
            aria-label="Previous track"
          >
            ⏮
          </button>
          <button
            type="button"
            className={`player-play ${playing ? 'playing' : ''}`}
            onClick={() => send('play')}
            disabled={!ready}
            title={playing ? 'Pause' : 'Play'}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? 'Ⅱ' : '▶'}
          </button>
          <button
            type="button"
            className="player-icon"
            onClick={() => send('next')}
            disabled={!ready}
            title="Next track"
            aria-label="Next track"
          >
            ⏭
          </button>
          <button
            type="button"
            className={`player-icon player-fav ${snapshot?.favorite ? 'active' : ''}`}
            onClick={() => send('favorite')}
            disabled={!ready || !snapshot?.hasTrack}
            title="Toggle favorite"
            aria-label="Toggle favorite"
            aria-pressed={snapshot?.favorite === true}
          >
            {snapshot?.favorite ? '♥' : '♡'}
          </button>
        </div>

        <span className="player-queue" title="Tracks in queue">
          {snapshot ? `${snapshot.queueLength} queued` : 'Loading…'}
        </span>

        <button type="button" className="ghost-button small danger player-stop" onClick={onStop}>
          <Icon name="close" size={14} />
          Stop
        </button>
      </div>

      {notice && (
        <div className="player-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="ghost-button small" onClick={reload}>
            <Icon name="refresh" size={13} />
            Reload player
          </button>
        </div>
      )}

      <div className="player-frame-wrap">
        {!loaded && (
          <div className="player-loading">
            <Icon name="music" size={26} />
            <span>Loading ArtistWave…</span>
          </div>
        )}
        <iframe
          key={frameKey}
          className="player-frame"
          src={APP_URL}
          title="ArtistWave"
          allow="autoplay; encrypted-media; fullscreen; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  )
}
