import { BrowserWindow } from 'electron'
import type { WebFrameMain } from 'electron'
import type {
  ArtistWaveAction,
  ArtistWaveSnapshot,
  ArtistWaveStatus,
  ArtistWaveValue
} from '../../shared/types'

/**
 * ArtistWave runs inside the dashboard as an embedded page. The renderer mounts
 * the iframe and tells this service when to attach; from then on we talk to the
 * page through `window.ArtistWaveMiniHost` and mirror its state back to the UI.
 * One window, one player — no second app window to manage.
 */
const APP_PREFIX = 'https://28121978444.github.io/ArtistWave/'
const POLL_MS = 1000
const MAX_PROBE_FAILURES = 20
const MAX_UP_NEXT = 4

const ACTIONS = new Set<ArtistWaveAction>([
  'play',
  'next',
  'previous',
  'favorite',
  'save',
  'shuffle',
  'repeat',
  'seek',
  'volume',
  'track',
  'queuePlay'
])

interface SiteState {
  title?: unknown
  artist?: unknown
  cover?: unknown
  source?: unknown
  playing?: unknown
  currentTime?: unknown
  duration?: unknown
  volume?: unknown
  favorite?: unknown
  hasTrack?: unknown
  shuffle?: unknown
  repeat?: unknown
  queue?: unknown
  smartQueue?: unknown
  selected?: unknown
  queueLength?: unknown
  upNext?: unknown
}

let host: BrowserWindow | null = null
let attached = false
let pageVisible = false
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollBusy = false
let probeFailures = 0
let status: ArtistWaveStatus = closedStatus()

function closedStatus(): ArtistWaveStatus {
  return {
    open: false,
    visible: false,
    loading: false,
    ready: false,
    error: null,
    snapshot: null
  }
}

function broadcast(): void {
  const payload = status
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) continue
    try {
      window.webContents.send('artistwave:update', payload)
    } catch {
      // A closing window is not a problem for the remaining ones.
    }
  }
}

function update(patch: Partial<ArtistWaveStatus>): void {
  status = { ...status, ...patch }
  broadcast()
}

function sameAppUrl(url: string): boolean {
  return url.startsWith(APP_PREFIX)
}

function findFrame(window: BrowserWindow): WebFrameMain | null {
  if (window.isDestroyed() || window.webContents.isDestroyed()) return null
  try {
    for (const frame of window.webContents.mainFrame.framesInSubtree) {
      if (sameAppUrl(frame.url)) return frame
    }
  } catch {
    // The frame tree can disappear mid-poll while React swaps pages.
  }
  return null
}

const PROBE_SCRIPT = `(() => {
  const host = window.ArtistWaveMiniHost
  if (!host || typeof host.state !== 'function') return null
  try {
    const state = host.state()
    if (!state || state.ready !== true) return null
    const queue = Array.isArray(state.queue) ? state.queue : []
    const smart = Array.isArray(state.smartQueue) ? state.smartQueue : []
    let upNext = []
    if (smart.length) {
      upNext = smart.slice(0, ${MAX_UP_NEXT}).map((track) => ({
        title: track && track.title,
        artist: track && track.artist,
        index: track && track.index,
        source: 'smart'
      }))
    } else if (queue.length) {
      const selected = Number.isInteger(state.selected) ? state.selected : -1
      const ordered = selected >= 0
        ? queue.slice(selected + 1).concat(queue.slice(0, selected))
        : queue.slice()
      upNext = ordered.slice(0, ${MAX_UP_NEXT}).map((track) => ({
        title: track && track.title,
        artist: track && track.artist,
        index: track && track.index,
        source: 'library'
      }))
    }
    return {
      title: state.title,
      artist: state.artist,
      cover: state.cover,
      source: state.source,
      playing: state.playing,
      currentTime: state.currentTime,
      duration: state.duration,
      volume: state.volume,
      favorite: state.favorite,
      hasTrack: state.hasTrack,
      shuffle: state.shuffle,
      repeat: state.repeat,
      queueLength: queue.length + smart.length,
      upNext
    }
  } catch {
    return null
  }
})()`

function clockSafe(value: unknown, maximum?: number): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return 0
  if (maximum !== undefined && maximum > 0) return Math.min(number, maximum)
  return number
}

function normalizeSnapshot(raw: SiteState): ArtistWaveSnapshot {
  const duration = clockSafe(raw.duration)
  const cover = typeof raw.cover === 'string' && /^https:\/\//i.test(raw.cover) ? raw.cover : ''
  const repeat = typeof raw.repeat === 'string' ? raw.repeat : 'Repeat: off'
  const upNext = Array.isArray(raw.upNext)
    ? raw.upNext
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          title: typeof item.title === 'string' ? item.title : '',
          artist: typeof item.artist === 'string' ? item.artist : '',
          index: Number.isInteger(item.index) ? (item.index as number) : -1,
          source: item.source === 'smart' ? ('smart' as const) : ('library' as const)
        }))
        .filter((item) => item.index >= 0 && item.title)
        .slice(0, MAX_UP_NEXT)
    : []

  return {
    title: typeof raw.title === 'string' && raw.title ? raw.title : 'Nothing playing yet',
    artist:
      typeof raw.artist === 'string' && raw.artist ? raw.artist : 'Choose a track in ArtistWave',
    cover,
    source: typeof raw.source === 'string' && raw.source ? raw.source : 'READY',
    playing: raw.playing === true,
    currentTime: clockSafe(raw.currentTime, duration || undefined),
    duration,
    volume: Math.min(1, Math.max(0, Number(raw.volume) || 0)),
    favorite: raw.favorite === true,
    hasTrack: raw.hasTrack === true,
    shuffle: raw.shuffle === true,
    repeat,
    queueLength: Number.isInteger(raw.queueLength) ? (raw.queueLength as number) : 0,
    upNext
  }
}

async function poll(): Promise<ArtistWaveStatus> {
  if (!attached || !host || host.isDestroyed() || pollBusy) return status
  pollBusy = true
  try {
    const frame = findFrame(host)
    if (!frame) {
      probeFailures += 1
      if (probeFailures === MAX_PROBE_FAILURES) {
        update({
          loading: false,
          error: status.ready
            ? 'Lost contact with the ArtistWave player. Reload the page to reconnect.'
            : 'ArtistWave is taking too long to load. Check your connection and reload the page.'
        })
      }
      return status
    }

    const raw = (await frame.executeJavaScript(PROBE_SCRIPT, false)) as SiteState | null
    if (!attached) return status
    if (!raw) {
      probeFailures += 1
      if (probeFailures === MAX_PROBE_FAILURES) {
        update({
          loading: false,
          error: status.ready
            ? 'Lost contact with the ArtistWave player. Reload the page to reconnect.'
            : 'ArtistWave loaded, but its player controls were not found. Try reloading.'
        })
      }
      return status
    }

    probeFailures = 0
    status = {
      open: true,
      visible: pageVisible,
      loading: false,
      ready: true,
      error: null,
      snapshot: normalizeSnapshot(raw)
    }
    broadcast()
  } catch {
    if (!attached) return status
    probeFailures += 1
    if (probeFailures === MAX_PROBE_FAILURES) {
      update({
        loading: false,
        error: 'Lost contact with the ArtistWave player. Reload the page to reconnect.'
      })
    }
  } finally {
    pollBusy = false
  }
  return status
}

function startPolling(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(() => void poll(), POLL_MS)
}

export function attachArtistWave(window: BrowserWindow): ArtistWaveStatus {
  host = window
  attached = true
  probeFailures = 0
  status = {
    open: true,
    visible: pageVisible,
    loading: true,
    ready: false,
    error: null,
    snapshot: null
  }
  broadcast()
  startPolling()
  void poll()
  return status
}

export function detachArtistWave(): ArtistWaveStatus {
  attached = false
  host = null
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  pollBusy = false
  probeFailures = 0
  status = closedStatus()
  broadcast()
  return status
}

export function setArtistWaveVisible(visible: boolean): ArtistWaveStatus {
  pageVisible = visible
  if (attached) update({ visible })
  return status
}

export function getArtistWaveStatus(): ArtistWaveStatus {
  if (attached && host && (host.isDestroyed() || host.webContents.isDestroyed())) {
    return detachArtistWave()
  }
  return status
}

function validateValue(
  action: ArtistWaveAction,
  value: unknown
): ArtistWaveValue | null {
  if (value === undefined || value === null) {
    if (action === 'seek' || action === 'volume' || action === 'track' || action === 'queuePlay') {
      throw new Error('This ArtistWave command needs a value.')
    }
    return null
  }
  if (action === 'seek') {
    const number = Number(value)
    if (!Number.isFinite(number)) throw new Error('Seek value is invalid.')
    return Math.min(1, Math.max(0, number))
  }
  if (action === 'volume') {
    const number = Number(value)
    if (!Number.isFinite(number)) throw new Error('Volume value is invalid.')
    return Math.min(100, Math.max(0, number))
  }
  if (action === 'track' || action === 'queuePlay') {
    const number = Number(value)
    if (!Number.isInteger(number) || number < 0) throw new Error('Track value is invalid.')
    return number
  }
  return null
}

export async function commandArtistWave(
  action: unknown,
  value: unknown
): Promise<ArtistWaveStatus> {
  if (typeof action !== 'string' || !ACTIONS.has(action as ArtistWaveAction)) {
    throw new Error('Unknown ArtistWave command.')
  }
  if (!attached || !host || host.isDestroyed()) {
    throw new Error('The ArtistWave player is not open. Open the player page first.')
  }
  const frame = findFrame(host)
  if (!frame) throw new Error('ArtistWave is still loading. Try again in a moment.')

  const normalized = validateValue(action as ArtistWaveAction, value)
  const script = `(() => {
    const host = window.ArtistWaveMiniHost
    if (!host || typeof host.command !== 'function') return false
    host.command(${JSON.stringify(action)}, ${
      normalized === null ? 'null' : JSON.stringify(normalized)
    })
    return true
  })()`

  let accepted = false
  try {
    accepted = (await frame.executeJavaScript(script, false)) === true
  } catch {
    accepted = false
  }
  if (!accepted) throw new Error('ArtistWave is still loading. Try again in a moment.')

  await new Promise((resolve) => setTimeout(resolve, 120))
  return poll()
}

export function stopArtistWave(): void {
  attached = false
  host = null
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  pollBusy = false
}
