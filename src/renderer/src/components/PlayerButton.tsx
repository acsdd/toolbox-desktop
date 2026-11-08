import { useEffect, useState } from 'react'
import type { ArtistWaveStatus } from '@shared/types'
import { Icon } from './Icon'

interface PlayerButtonProps {
  active: boolean
  onToggle: () => void
}

/**
 * The one button beside the header clock that opens the embedded ArtistWave
 * page. It doubles as a now-playing light so playback stays glanceable from
 * every other page.
 */
export function PlayerButton({ active, onToggle }: PlayerButtonProps) {
  const [status, setStatus] = useState<ArtistWaveStatus | null>(null)

  useEffect(() => {
    let alive = true
    window.api.artistwave
      .status()
      .then((next) => {
        if (alive) setStatus(next)
      })
      .catch(() => {})
    const unsubscribe = window.api.artistwave.onUpdate((next) => {
      if (alive) setStatus(next)
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const snapshot = status?.snapshot
  const playing = snapshot?.playing === true
  const summary = playing
    ? `${snapshot?.title ?? 'ArtistWave'} by ${snapshot?.artist ?? 'ArtistWave'}`
    : status?.open
      ? 'ArtistWave is open'
      : 'ArtistWave'

  return (
    <button
      type="button"
      className={`player-button ${active ? 'active' : ''} ${playing ? 'playing' : ''}`}
      onClick={onToggle}
      aria-pressed={active}
      title={playing ? `${summary} — open player` : 'Open the ArtistWave player'}
      aria-label={playing ? `${summary}. Open the ArtistWave player.` : 'Open the ArtistWave player'}
    >
      <Icon name="music" size={18} />
      <span className="player-button-copy">
        <span className="player-button-label">Player</span>
        <span className="player-button-sub">{playing ? `Playing · ${snapshot?.artist}` : 'ArtistWave'}</span>
      </span>
      <span className={`player-button-dot ${playing ? 'playing' : ''}`} aria-hidden="true" />
    </button>
  )
}
